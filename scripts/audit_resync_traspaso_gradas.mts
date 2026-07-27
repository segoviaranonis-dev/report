/**
 * Auditoría integridad pares TRP vs FI — Bazzar Web Compra (cliente 5000).
 * Uso: npx tsx scripts/audit_resync_traspaso_gradas.mts [--apply] [--trp ID]
 */
import pg from "pg";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { resyncTraspasoDetalleFromFactura } from "../src/lib/rimec-abastecimiento/traspaso-mutations.ts";
import { gradasFmtToTallas, scaleGradesToPares } from "../src/lib/rimec-abastecimiento/traspaso-mutations.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
}

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const trpArg = args.find((a) => a.startsWith("--trp="));
const trpFilter = trpArg ? parseInt(trpArg.split("=")[1] ?? "", 10) : null;

// Smoke lógica gradas (sin BD)
const smoke = gradasFmtToTallas("38(1 2 3 3 2 1)43");
const scaled = scaleGradesToPares(smoke, 12);
const smokeSum = Object.values(scaled).reduce((a, b) => a + b, 0);
console.log("SMOKE grada 38-43 →", scaled, "suma=", smokeSum, smokeSum === 12 ? "OK" : "FAIL");

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost") ? undefined : { rejectUnauthorized: false },
});

const auditSql = `
  SELECT
    t.id AS trp_id,
    t.numero_registro,
    t.estado,
    t.documento_ref,
    COALESCE(fi.total_pares, 0)::int AS fi_pares,
    COALESCE(SUM(td.cantidad), 0)::int AS td_pares,
    COALESCE(fi.total_pares, 0)::int - COALESCE(SUM(td.cantidad), 0)::int AS delta
  FROM traspaso t
  LEFT JOIN factura_interna fi ON fi.nro_factura = t.documento_ref
  LEFT JOIN traspaso_detalle td ON td.traspaso_id = t.id
  WHERE t.almacen_destino_id = 1
    AND (
      fi.cliente_id = 5000
      OR EXISTS (
        SELECT 1 FROM venta_transito vt
        WHERE vt.numero_factura_interna = t.documento_ref AND vt.codigo_cliente = '5000'
      )
    )
    ${trpFilter ? `AND t.id = ${trpFilter}` : ""}
  GROUP BY t.id, t.numero_registro, t.estado, t.documento_ref, fi.total_pares
  HAVING COALESCE(fi.total_pares, 0) > 0
     AND COALESCE(SUM(td.cantidad), 0) <> COALESCE(fi.total_pares, 0)
  ORDER BY t.id DESC
`;

const { rows: mismatches } = await pool.query(auditSql);
console.log(`\nTRP con delta FI≠detalle: ${mismatches.length}`);
for (const r of mismatches) {
  console.log(
    `  TRP ${r.trp_id} ${r.numero_registro} [${r.estado}] FI=${r.documento_ref} fi=${r.fi_pares} td=${r.td_pares} Δ=${r.delta}`,
  );
}

if (apply && mismatches.length) {
  const client = await pool.connect();
  try {
    for (const r of mismatches) {
      if (r.estado === "CONFIRMADO") {
        console.log(`  SKIP ${r.trp_id} CONFIRMADO — requiere repararIngresoTraspasoConfirmado`);
        continue;
      }
      await client.query("BEGIN");
      try {
        const res = await resyncTraspasoDetalleFromFactura(client, r.trp_id);
        if (res.ok) {
          await client.query("COMMIT");
          console.log(
            `  RESYNC OK ${r.trp_id}: ${res.paresAntes} → ${res.paresDespues} (FI ${res.fiPares})`,
          );
        } else {
          await client.query("ROLLBACK");
          console.log(`  RESYNC FAIL ${r.trp_id}: ${res.error}`);
        }
      } catch (e) {
        await client.query("ROLLBACK");
        console.log(`  RESYNC ERR ${r.trp_id}:`, e instanceof Error ? e.message : e);
      }
    }
  } finally {
    client.release();
  }
} else if (mismatches.length && !apply) {
  console.log("\nPara reparar: npx tsx scripts/audit_resync_traspaso_gradas.mts --apply");
}

await pool.end();
