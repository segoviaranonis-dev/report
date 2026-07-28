/**
 * Import Excel Logística Rimec + MIG-191.
 * Uso: npx tsx scripts/_import_logistica_rimec_excel.ts
 */
import fs from "fs";
import path from "path";
import pg from "pg";
import * as XLSX from "xlsx";
import { parseLogisticaRimecExcelRows } from "../src/lib/logistica-rimec/parse-excel-rimec";
import { importExcelRimec } from "../src/lib/logistica-rimec/queries";

async function main() {
  const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
  const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
  if (!url) throw new Error("no DATABASE_URL");

  const mig = fs.readFileSync(
    path.join(__dirname, "..", "migrations", "191_logistica_rimec_entidad_detalle.sql"),
    "utf8",
  );
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query(mig);
  console.log("OK MIG-191");
  await client.end();

  const xlsxPath = path.join(
    "C:",
    "Users",
    "hecto",
    "Nexus_Core",
    "csv's",
    "Logistica",
    "Logistica Rimec.xlsx",
  );
  const wb = XLSX.readFile(xlsxPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null }) as Record<string, unknown>[];
  const parsed = parseLogisticaRimecExcelRows(rows);
  console.log("parsed", parsed.stats);

  const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  const result = await importExcelRimec(pool, parsed, {
    archivoNombre: "Logistica Rimec.xlsx",
    usuarioId: null,
  });
  console.log("import", result);

  const c = await pool.query(
    `SELECT entidad_am, COUNT(*)::int n, SUM(monto_neto)::float8 monto
     FROM logistica_rimec_pendiente GROUP BY 1 ORDER BY 1`,
  );
  console.log("por entidad", c.rows);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
