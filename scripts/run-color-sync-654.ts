/**
 * Sync color.xlsx → BD + sugerir tono_canon (654).
 * Uso: npx tsx scripts/run-color-sync-654.ts [ruta.xlsx]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getRimecPool } from "../src/lib/rimec/pool";
import { parseColorXlsxBuffer, importColorRowsUpsert } from "../src/lib/pilares/import-color-xlsx";
import { ensureTonoCanonColumn, loadAndRecalcColoresEstandar, suggestTonoCanonBulk } from "../src/lib/pilares/queries";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
const envMatch = fs.readFileSync(envPath, "utf8").match(/^DATABASE_URL=(.+)$/m);
if (envMatch) process.env.DATABASE_URL = envMatch[1].trim().replace(/^"|"$/g, "");

const xlsxPath = process.argv[2] || path.join(__dirname, "..", "..", "color.xlsx");
const proveedorId = 654;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }
  const buf = fs.readFileSync(xlsxPath);
  const rows = parseColorXlsxBuffer(buf);
  const pool = getRimecPool();
  await ensureTonoCanonColumn(pool);
  const imported = await importColorRowsUpsert(pool, proveedorId, rows);
  const catalog = await loadAndRecalcColoresEstandar(pool, proveedorId);
  const tono = await suggestTonoCanonBulk(pool, proveedorId, catalog);
  const after = await pool.query<{ sin_nombre: string; sin_tono: string; con_tono: string }>(
    `SELECT
      COUNT(*) FILTER (WHERE nombre IS NULL OR btrim(nombre)='')::text AS sin_nombre,
      COUNT(*) FILTER (WHERE tono_canon IS NULL)::text AS sin_tono,
      COUNT(*) FILTER (WHERE tono_canon IS NOT NULL)::text AS con_tono
     FROM color WHERE proveedor_id=$1 AND activo=true`,
    [proveedorId],
  );
  console.log(JSON.stringify({ xlsx: xlsxPath, imported, tono_suggested: tono, after: after.rows[0] }, null, 2));
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
