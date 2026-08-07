/**
 * Audita TODAS las FI PE CONFIRMADA — tier LP vs CSV simulado.
 * Uso: npx tsx scripts/audit_csv_pe_tier_all.ts [--fi-id=N]
 */
import fs from "fs";
import pg from "pg";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  buildCsvRowsFromFiDet,
  fetchPeVentasDetRowsByFiId,
} from "../src/lib/facturacion/csv-pe-ventas-export";
import {
  auditPeCsvTierIntegrity,
  formatPeCsvTierViolation,
} from "../src/lib/facturacion/csv-pe-tier-audit";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");
const envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
const dbLine = envText.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
const dbUrl = dbLine?.slice("DATABASE_URL=".length).replace(/^["']|["']$/g, "").trim();
if (!dbUrl) {
  console.error("FAIL: DATABASE_URL no encontrada en .env.local");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: dbUrl });
const fiArg = process.argv.find((a) => a.startsWith("--fi-id="));
const onlyFi = fiArg ? Number(fiArg.split("=")[1]) : null;

async function main() {
  const { rows: fis } = await pool.query<{ id: number; nro_factura: string; lista_precio_id: number | null }>(
  `
  SELECT fi.id, fi.nro_factura, fi.lista_precio_id
  FROM factura_interna fi
  WHERE fi.estado = 'CONFIRMADA'
    AND TRIM(COALESCE(fi.nro_factura, '')) LIKE 'PE-%'
    ${onlyFi ? "AND fi.id = $1" : ""}
  ORDER BY fi.id DESC
  LIMIT ${onlyFi ? 1 : 500}
  `,
  );

  let totalViolations = 0;
  let ok = 0;
  let fail = 0;

  for (const fi of fis) {
    try {
      const detRows = await fetchPeVentasDetRowsByFiId(pool, fi.id);
      if (!detRows.length) continue;
      const listaPrecioId = fi.lista_precio_id != null ? Number(fi.lista_precio_id) : 1;
      const csvRows = buildCsvRowsFromFiDet(detRows);
      const violations = auditPeCsvTierIntegrity(detRows, csvRows, listaPrecioId);
      if (violations.length) {
        fail++;
        totalViolations += violations.length;
        console.error(`FAIL ${fi.nro_factura} (id=${fi.id}) · ${violations.length} violación(es)`);
        for (const v of violations.slice(0, 5)) {
          console.error("  ", formatPeCsvTierViolation(v));
        }
      } else {
        ok++;
      }
    } catch (e) {
      fail++;
      console.error(`ERROR ${fi.nro_factura} (id=${fi.id}):`, e instanceof Error ? e.message : e);
    }
  }

  console.log(
    `\nAuditoría CSV PE tier · FI revisadas: ${fis.length} · OK: ${ok} · FAIL: ${fail} · violaciones: ${totalViolations}`,
  );
  await pool.end();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
