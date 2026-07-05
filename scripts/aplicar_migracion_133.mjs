/**
 * MIG-133 — cliente 5000 → descp_cliente Bazzar.py
 * Uso: node scripts/aplicar_migracion_133.mjs
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

const sql = readFileSync(resolve(root, "migrations/133_cliente_5000_bazzar_py.sql"), "utf8");
const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
});

try {
  await pool.query(sql);
  const check = await pool.query(
    "SELECT id_cliente, descp_cliente FROM cliente_v2 WHERE id_cliente = 5000",
  );
  console.log("OK MIG-133", check.rows[0] ?? "sin fila 5000");
} catch (e) {
  console.error("FAIL MIG-133", e.message);
  process.exit(1);
} finally {
  await pool.end();
}
