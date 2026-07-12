import fs from "fs";
import pg from "pg";

const url = fs.readFileSync("c:/Users/hecto/Nexus_Core/report/.env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const c = new pg.Client({ connectionString: url });
await c.connect();
const dup = await c.query(`
  SELECT ic.id_cliente, COUNT(*)::int AS n, SUM(ic.cantidad_total_pares)::int AS pares
  FROM intencion_compra_pedido icp
  JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
  WHERE icp.pedido_proveedor_id = 25
  GROUP BY ic.id_cliente HAVING COUNT(*) > 1
  ORDER BY n DESC
`);
const tot = await c.query(`
  SELECT COUNT(*)::int AS ic_count, SUM(ic.cantidad_total_pares)::int AS total_pares
  FROM intencion_compra_pedido icp
  JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
  WHERE icp.pedido_proveedor_id = 25
`);
console.log("totales", tot.rows[0]);
console.log("dup clientes", dup.rows);
await c.end();
