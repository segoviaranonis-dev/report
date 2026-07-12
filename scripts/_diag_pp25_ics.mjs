import fs from "fs";
import pg from "pg";

const url = fs.readFileSync("c:/Users/hecto/Nexus_Core/report/.env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const c = new pg.Client({ connectionString: url });
await c.connect();

const ppId = 25;
const pp = await c.query(
  `SELECT id, numero_registro, numero_proforma, categoria_id, estado, quincena_arribo_id
   FROM pedido_proveedor WHERE id = $1`,
  [ppId],
);
console.log("PP:", pp.rows[0]);

const ics = await c.query(
  `SELECT ic.id, ic.numero_registro, ic.id_cliente, ic.cantidad_total_pares, ic.precio_evento_id, ic.listado_precio_id
   FROM intencion_compra_pedido icp
   JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
   WHERE icp.pedido_proveedor_id = $1
   ORDER BY ic.numero_registro`,
  [ppId],
);
console.log("IC count:", ics.rowCount);
console.log("IC sample:", ics.rows.slice(0, 5));

const evento = await c.query(
  `SELECT DISTINCT ic.precio_evento_id FROM intencion_compra_pedido icp
   JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
   WHERE icp.pedido_proveedor_id = $1 AND ic.precio_evento_id IS NOT NULL`,
  [ppId],
);
console.log("eventos IC:", evento.rows);

await c.end();
