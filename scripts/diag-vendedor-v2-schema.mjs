import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!url) throw new Error("DATABASE_URL missing");

const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
});

const tables = await pool.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name ILIKE '%vendedor%'
  ORDER BY table_name
`);
console.log("tablas vendedor:", tables.rows.map((r) => r.table_name));

for (const t of ["vendedor_v2", "vendedor_v2_deprecated"]) {
  try {
    const cols = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
      [t],
    );
    console.log(t, "columns:", cols.rows.map((r) => r.column_name));
    const c = await pool.query(`SELECT COUNT(*)::int AS n FROM ${t}`);
    const s = await pool.query(
      `SELECT id_vendedor, descp_vendedor FROM ${t} ORDER BY descp_vendedor LIMIT 5`,
    );
    console.log(t, "count", c.rows[0].n, "sample", s.rows);
  } catch (e) {
    console.log(t, "error", e.message);
  }
}

const fk = await pool.query(`
  SELECT conname, pg_get_constraintdef(oid) AS def
  FROM pg_constraint
  WHERE conrelid = 'intencion_compra'::regclass AND contype = 'f'
`);
console.log("intencion_compra FKs:", fk.rows);

const all = await pool.query(
  "SELECT id_vendedor, descp_vendedor FROM vendedor_v2_deprecated ORDER BY descp_vendedor",
);
console.log("vendedor_v2_deprecated all:", all.rows.length, all.rows);

await pool.end();
