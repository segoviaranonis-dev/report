import pg from "pg";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const envPath = join(dirname(fileURLToPath(import.meta.url)), "../.env.local");
const env = readFileSync(envPath, "utf8");
const m = env.match(/^DATABASE_URL=(.+)$/m);
const url = m?.[1]?.trim();
if (!url) throw new Error("DATABASE_URL missing");

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

const r = await pool.query(`
  SELECT cliente_id, COUNT(*)::int AS n,
         MIN(codigo_oro) AS sample,
         MAX(numero_fi_fa) AS fi_fa
  FROM bobeda_venta_pos
  WHERE upper(btrim(estado)) = 'PENDIENTE_ENTREGA'
  GROUP BY cliente_id
  ORDER BY cliente_id
`);
console.log("PENDIENTE_ENTREGA por tienda:", r.rows);

const all = await pool.query(`
  SELECT cliente_id, estado, COUNT(*)::int AS n
  FROM bobeda_venta_pos
  GROUP BY cliente_id, estado
  ORDER BY cliente_id, estado
`);
console.log("Todos estados bobeda:", all.rows);

await pool.end();
