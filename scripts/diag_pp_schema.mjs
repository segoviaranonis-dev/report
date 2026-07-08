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

const cols = await pool.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='public' AND table_name='pedido_proveedor'
  ORDER BY ordinal_position
`);
console.log("pedido_proveedor:", cols.rows.map((r) => r.column_name).join(", "));

const q = await pool.query(`SELECT id, descripcion FROM quincena_arribo WHERE descripcion ILIKE '%pronta%' LIMIT 5`);
console.log("quincenas:", q.rows);

const c = await pool.query("SELECT COUNT(*)::int AS n FROM stock_pronta_entrega_rimec");
console.log("staging:", c.rows[0]);

const qa = await pool.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='public' AND table_name='quincena_arribo'
  ORDER BY ordinal_position
`);
console.log("quincena_arribo cols:", qa.rows.map((r) => r.column_name).join(", "));

const ppd = await pool.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='public' AND table_name='pedido_proveedor_detalle'
  ORDER BY ordinal_position
`);
console.log("ppd cols:", ppd.rows.map((r) => r.column_name).join(", "));

await pool.end();
