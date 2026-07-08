import pg from "pg";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

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

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const sql = readFileSync(resolve(root, "migrations/144_v_stock_pe_rimec_marca_linea.sql"), "utf8");
await pool.query(sql);

const r = await pool.query(`
  SELECT descp_marca, count(*)::int AS n
  FROM v_stock_pe_rimec
  WHERE cajas_disponibles > 0
  GROUP BY descp_marca
  ORDER BY n DESC
  LIMIT 15
`);
console.log("OK MIG-144 top marcas:");
console.table(r.rows);

await pool.end();
