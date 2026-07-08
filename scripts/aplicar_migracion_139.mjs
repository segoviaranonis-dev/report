/**
 * MIG-139 — vincular_listado_a_pp con saldo parcial
 * Uso: node scripts/aplicar_migracion_139.mjs
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
  console.error("FAIL: DATABASE_URL no encontrada");
  process.exit(1);
}

const sql = readFileSync(resolve(root, "migrations/139_vincular_listado_saldo_parcial.sql"), "utf8");
const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
});

try {
  const t0 = Date.now();
  await pool.query(sql);
  const chk = await pool.query(`
    SELECT obj_description(p.oid, 'pg_proc') AS comment
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'vincular_listado_a_pp'
    LIMIT 1
  `);
  console.log(`OK MIG-139 (${Date.now() - t0}ms)`);
  console.log("fn comment:", chk.rows[0]?.comment ?? "—");
} catch (e) {
  console.error("FAIL MIG-139", e.message);
  process.exit(1);
} finally {
  await pool.end();
}
