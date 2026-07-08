import pg from "pg";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const m = env.match(/^DATABASE_URL=(.+)$/m);
const pool = new pg.Pool({ connectionString: m[1].trim() });

const pps = await pool.query(`
  SELECT pp.id, pp.numero_registro, pp.estado,
         icp.precio_evento_id,
         (SELECT COUNT(*) FROM pedido_proveedor_detalle d WHERE d.pedido_proveedor_id=pp.id AND COALESCE(d.pares_vendidos,0)>0)::int vendidas,
         (SELECT COUNT(*) FROM factura_interna fi WHERE fi.pp_id=pp.id AND fi.estado='CONFIRMADA')::int fi_conf,
         (SELECT SUM(fi.total_monto)::bigint FROM factura_interna fi WHERE fi.pp_id=pp.id) sum_fi_monto
  FROM pedido_proveedor pp
  LEFT JOIN intencion_compra_pedido icp ON icp.pedido_proveedor_id = pp.id
  WHERE pp.estado = 'ABIERTO'
    AND EXISTS (SELECT 1 FROM pedido_proveedor_detalle d WHERE d.pedido_proveedor_id=pp.id AND COALESCE(d.pares_vendidos,0)>0)
  ORDER BY pp.id DESC
  LIMIT 15
`);
console.log("PPs ABIERTO con ventas:", pps.rows);

const fn = await pool.query(`
  SELECT obj_description(p.oid, 'pg_proc') AS c
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='vincular_listado_a_pp'
`);
console.log("fn:", fn.rows[0]?.c);

await pool.end();
