import fs from "fs";
import pg from "pg";

const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const c = new pg.Client({ connectionString: url });
await c.connect();

const ppId = 26;

const pp = await c.query(
  `SELECT id, numero_registro, numero_proforma, pares_comprometidos, estado
   FROM pedido_proveedor WHERE id = $1`,
  [ppId],
);
console.log("PP:", pp.rows[0]);

const ppd = await c.query(
  `SELECT COUNT(*)::int AS n, COALESCE(SUM(cantidad_pares),0)::int AS pares,
          COALESCE(SUM(pares_vendidos),0)::int AS vendidos
   FROM pedido_proveedor_detalle WHERE pedido_proveedor_id = $1`,
  [ppId],
);
console.log("PPD:", ppd.rows[0]);

const fi = await c.query(
  `SELECT COUNT(*)::int AS n, COALESCE(SUM(total_pares),0)::int AS pares
   FROM factura_interna WHERE pp_id = $1`,
  [ppId],
);
console.log("FI:", fi.rows[0]);

const ics = await c.query(
  `SELECT COUNT(*)::int AS n, SUM(ic.cantidad_total_pares)::int AS pares
   FROM intencion_compra_pedido icp
   JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
   WHERE icp.pedido_proveedor_id = $1`,
  [ppId],
);
console.log("ICs:", ics.rows[0]);

const sampleFi = await c.query(
  `SELECT nro_factura, estado, total_pares FROM factura_interna WHERE pp_id = $1 LIMIT 5`,
  [ppId],
);
console.log("FI sample:", sampleFi.rows);

await c.end();
