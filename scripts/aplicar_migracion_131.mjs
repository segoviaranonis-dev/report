/**
 * MIG-131 — cantidad_importada en 18 tablas depósito Bazzar.
 * Uso: node scripts/aplicar_migracion_131.mjs
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

const sql = readFileSync(resolve(root, "migrations/131_deposito_cantidad_importada.sql"), "utf8");
const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
});

console.log("MIG-131: cantidad_importada en depósitos Bazzar…");

const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  console.log("OK: migración aplicada");

  const col = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deposito_1_2100_tienda'
      AND column_name = 'cantidad_importada'
  `);
  console.log("Columna 2100 tienda:", col.rows[0]?.column_name ?? "MISSING");
} catch (e) {
  await client.query("ROLLBACK");
  console.error("FAIL:", e.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
