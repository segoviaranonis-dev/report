import fs from "fs";
import pg from "pg";

const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const c = new pg.Client({ connectionString: url });
await c.connect();
const r = await c.query(`
  SELECT pp.id, pp.numero_registro, pp.numero_proforma, pp.categoria_id,
    (SELECT COUNT(*)::int FROM pedido_proveedor_detalle d WHERE d.pedido_proveedor_id=pp.id) AS ppd,
    (SELECT COUNT(*)::int FROM factura_interna fi WHERE fi.pp_id=pp.id) AS fi,
    (SELECT COUNT(*)::int FROM intencion_compra_pedido icp WHERE icp.pedido_proveedor_id=pp.id) AS ic
  FROM pedido_proveedor pp
  WHERE pp.numero_registro IN ('PP-2026-0017','PP-2026-0019')
  ORDER BY pp.id`);
console.log("PP:", r.rows);
const snap = await c.query(`
  SELECT pp_id FROM pp_proforma_filas WHERE pp_id = ANY($1::bigint[])`, 
  [r.rows.map(x => x.id)]);
console.log("snapshots:", snap.rows);
await c.end();
