/**
 * MIG-140 + MIG-141 — Alejandro Magno PE en PPD · drop v_stock_pe_rimec
 * Uso: node scripts/aplicar_migracion_140.mjs
 * Luego: python ../control_central/scripts/migrate_pe_staging_to_ppd.py
 */
import pg from "pg";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const envPath = resolve(root, ".env.local");

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("FAIL: DATABASE_URL no encontrada en report/.env.local");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
});

async function runFile(name) {
  const sql = readFileSync(resolve(root, `migrations/${name}`), "utf8");
  const t0 = Date.now();
  await pool.query(sql);
  console.log(`OK ${name} (${Date.now() - t0}ms)`);
}

try {
  await runFile("140_alejandro_magno_pe_ppd.sql");
  await runFile("141_drop_v_stock_pe_rimec.sql");

  const qa = await pool.query(
    `SELECT id, descripcion FROM quincena_arribo WHERE lower(trim(descripcion)) = lower('Pronta entrega')`,
  );
  console.log("quincena PE:", qa.rows[0]);

  const peView = await pool.query(`
    SELECT EXISTS (
      SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'v_stock_pe_rimec'
    ) AS exists
  `);
  console.log("v_stock_pe_rimec exists:", peView.rows[0].exists);

  const cp = await pool.query(`
    SELECT COUNT(*)::int AS filas FROM v_stock_rimec
  `);
  console.log("v_stock_rimec (CP):", cp.rows[0]);
} catch (e) {
  console.error("FAIL MIG-140/141", e.message);
  process.exit(1);
} finally {
  await pool.end();
}
