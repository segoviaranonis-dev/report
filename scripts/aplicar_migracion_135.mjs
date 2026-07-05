/**
 * MIG-135 — columna_stock_legal
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
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("FAIL: DATABASE_URL");
  process.exit(1);
}

const sql = readFileSync(resolve(root, "migrations/135_stock_pe_columna_legal.sql"), "utf8");
const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
});

try {
  await pool.query(sql);
  const chk = await pool.query(`
    SELECT deposito_codigo, columna_stock_legal, COUNT(*)::int AS n
    FROM stock_pronta_entrega_rimec
    GROUP BY 1, 2 ORDER BY 1
  `);
  console.log("OK MIG-135");
  console.table(chk.rows);
} catch (e) {
  console.error("FAIL MIG-135", e.message);
  process.exit(1);
} finally {
  await pool.end();
}
