import fs from "fs";
import pg from "pg";

const url = fs.readFileSync("c:/Users/hecto/Nexus_Core/report/.env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const c = new pg.Client({ connectionString: url });
await c.connect();
const r = await c.query(`
  SELECT ic.id_cliente, ic.numero_registro, ic.cantidad_total_pares, ic.id_vendedor, ic.descuento_1
  FROM intencion_compra_pedido icp
  JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
  WHERE icp.pedido_proveedor_id = 25 AND ic.id_cliente = 945
  ORDER BY ic.id
`);
console.log(JSON.stringify(r.rows, null, 2));
await c.end();
