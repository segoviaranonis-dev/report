import fs from "fs";
import pg from "pg";

const url = fs.readFileSync("c:/Users/hecto/Nexus_Core/report/.env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const c = new pg.Client({ connectionString: url });
await c.connect();
const r = await c.query(`
  SELECT pp.id, pp.numero_registro, pp.numero_proforma, pp.categoria_id, pp.estado,
         pp.quincena_arribo_id,
         (SELECT COUNT(*)::int FROM pedido_proveedor_detalle d WHERE d.pedido_proveedor_id = pp.id) AS ppd_count,
         (SELECT COUNT(*)::int FROM intencion_compra_pedido icp WHERE icp.pedido_proveedor_id = pp.id) AS ic_count,
         (SELECT COUNT(*)::int FROM factura_interna fi WHERE fi.pp_id = pp.id) AS fi_count
  FROM pedido_proveedor pp
  WHERE pp.id = 25 OR pp.numero_registro ILIKE '%0016%'
  ORDER BY pp.id
`);
console.log(JSON.stringify(r.rows, null, 2));
await c.end();
