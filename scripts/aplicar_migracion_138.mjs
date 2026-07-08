/**
 * MIG-138 — Saneamiento catálogo CP (revierte UNION PE en v_stock_rimec)
 * Uso: node scripts/aplicar_migracion_138.mjs
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

const sql = readFileSync(resolve(root, "migrations/138_v_stock_rimec_saneamiento_catalogo_cp.sql"), "utf8");
const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
});

try {
  const t0 = Date.now();
  await pool.query(sql);
  const cp = await pool.query(`
    SELECT COUNT(*)::int AS filas_cp,
           COUNT(*) FILTER (WHERE cajas_disponibles > 0)::int AS vendibles
    FROM v_stock_rimec
  `);
  const pe = await pool.query(`SELECT COUNT(*)::int AS filas_pe FROM v_stock_pe_rimec`);
  console.log(`OK MIG-138 (${Date.now() - t0}ms)`);
  console.log("v_stock_rimec (CP):", cp.rows[0]);
  console.log("v_stock_pe_rimec:", pe.rows[0]);
} catch (e) {
  console.error("FAIL MIG-138", e.message);
  process.exit(1);
} finally {
  await pool.end();
}
