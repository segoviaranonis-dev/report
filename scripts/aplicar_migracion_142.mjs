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

const sql = readFileSync(resolve(root, "migrations/142_v_stock_pe_rimec_desde_ppd.sql"), "utf8");
await pool.query(sql);

const pe = await pool.query(`
  SELECT COUNT(*)::int AS filas,
         COUNT(*) FILTER (WHERE cajas_disponibles > 0)::int AS vendibles
  FROM v_stock_pe_rimec
`);
const cp = await pool.query(`SELECT COUNT(*)::int AS filas FROM v_stock_rimec`);
console.log("OK MIG-142");
console.log("v_stock_pe_rimec:", pe.rows[0]);
console.log("v_stock_rimec CP:", cp.rows[0]);

await pool.end();
