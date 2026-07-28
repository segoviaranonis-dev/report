import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    process.env[t.slice(0, eq).trim()] ??= t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
}

const sql = readFileSync(resolve(root, "migrations/191_v_stock_pe_rimec_fast_am.sql"), "utf8");
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const client = await pool.connect();
try {
  console.log("Applying MIG-191…");
  await client.query(sql);
  const t0 = Date.now();
  const { rows } = await client.query("SELECT count(*)::int AS n FROM v_stock_pe_rimec");
  console.log("count_all", rows[0].n, `${Date.now() - t0}ms`);
  const t1 = Date.now();
  await client.query(`
    SELECT det_id FROM v_stock_pe_rimec
    WHERE ramo_tipo = 'CALZADO'
    ORDER BY linea_codigo, referencia_codigo, material_code, color_code
    LIMIT 30
  `);
  console.log("page30_ordered", `${Date.now() - t1}ms`);
  console.log("OK MIG-191");
} finally {
  client.release();
  await pool.end();
}
