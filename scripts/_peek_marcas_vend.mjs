import fs from "fs";
import pg from "pg";

const url = fs.readFileSync("c:/Users/hecto/Nexus_Core/report/.env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const pool = new pg.Pool({ connectionString: url });
const m = await pool.query("SELECT id_marca, descp_marca FROM marca_v2 WHERE id_marca = ANY($1::int[])", [
  [1, 2, 3, 4, 5, 6, 7, 8, 201, 501],
]);
console.log("marcas", m.rows);
const v = await pool.query("SELECT id_vendedor, descp_vendedor FROM vendedor_v2 ORDER BY id_vendedor");
console.log("vendedores count", v.rows.length);
console.log(v.rows.filter((r) => /ADMIN|CAJA|OFICINA|CASA|RIMEC/i.test(r.descp_vendedor)));
await pool.end();
