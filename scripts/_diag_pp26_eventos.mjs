import fs from "fs";
import pg from "pg";

const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const c = new pg.Client({ connectionString: url });
await c.connect();

const ppId = Number(process.env.DIAG_PP ?? 26);

const ev = await c.query(
  `SELECT ic.precio_evento_id, COUNT(*)::int AS n, SUM(ic.cantidad_total_pares)::int AS pares
   FROM intencion_compra_pedido icp
   JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
   WHERE icp.pedido_proveedor_id = $1
   GROUP BY ic.precio_evento_id ORDER BY n DESC`,
  [ppId],
);
console.log(`ICs por evento PP ${ppId}:`, ev.rows);

const ic37 = await c.query(
  `SELECT ic.numero_registro, ic.id_cliente, ic.cantidad_total_pares
   FROM intencion_compra_pedido icp JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
   WHERE icp.pedido_proveedor_id = $1 AND ic.precio_evento_id = 37 ORDER BY ic.numero_registro`,
  [ppId],
);
console.log("ICs aún en evento 37:", ic37.rows);

const cab = await c.query(
  "SELECT numero_registro, quincena_arribo_id, numero_proforma, pares_comprometidos FROM pedido_proveedor WHERE id = $1",
  [ppId],
);
console.log("Cabecera PP:", cab.rows[0]);

await c.end();
