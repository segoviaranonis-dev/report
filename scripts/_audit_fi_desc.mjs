import pg from "pg";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const m = env.match(/^DATABASE_URL=(.+)$/m);
const pool = new pg.Pool({ connectionString: m[1].trim() });
const r = await pool.query(`
  SELECT fi.id, fi.descuento_1, fi.descuento_2, fi.lista_precio_id, fi.total_monto, fi.estado
  FROM factura_interna fi WHERE fi.pp_id IN (14,15) LIMIT 5
`);
console.log(r.rows);
await pool.end();
