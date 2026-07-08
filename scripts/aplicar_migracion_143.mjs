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

const sql = readFileSync(resolve(root, "migrations/143_v_stock_pe_rimec_joins_indexables.sql"), "utf8");
await pool.query(sql);

const t0 = Date.now();
const pe = await pool.query(`
  SELECT COUNT(*)::int AS filas,
         COUNT(*) FILTER (WHERE cajas_disponibles > 0)::int AS vendibles
  FROM v_stock_pe_rimec
`);
console.log("count ms:", Date.now() - t0, pe.rows[0]);

const t1 = Date.now();
const sample = await pool.query(`
  SELECT det_id, descp_marca, cajas_disponibles, material_code
  FROM v_stock_pe_rimec
  WHERE cajas_disponibles > 0
  ORDER BY det_id
  LIMIT 80
`);
console.log("sample 80 ms:", Date.now() - t1, "rows:", sample.rowCount);

await pool.end();
console.log("OK MIG-143");
