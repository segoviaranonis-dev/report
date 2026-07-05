/**
 * MIG-134 — v_stock_rimec UNION pronta entrega
 * Uso: node scripts/aplicar_migracion_134.mjs
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

const sql = readFileSync(resolve(root, "migrations/134_v_stock_rimec_union_pe.sql"), "utf8");
const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
});

try {
  await pool.query(sql);
  const chk = await pool.query(`
    SELECT origen_tipo, COUNT(*)::int AS n, SUM(cajas_disponibles)::bigint AS cajas
    FROM v_stock_rimec
    GROUP BY origen_tipo
    ORDER BY origen_tipo
  `);
  console.log("OK MIG-134 v_stock_rimec UNION");
  console.table(chk.rows);
} catch (e) {
  console.error("FAIL MIG-134", e.message);
  process.exit(1);
} finally {
  await pool.end();
}
