import fs from "fs";
import pg from "pg";

const url = fs.readFileSync("c:/Users/hecto/Nexus_Core/report/.env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const client = new pg.Client({ connectionString: url });
await client.connect();

const { rows: pp } = await client.query(`
  SELECT pp.id, pp.numero_registro, pp.estado, pp.estado_transito, pp.compra_previa,
         pp.categoria_id, pp.quincena_arribo_id, qa.descripcion AS embarque,
         pp.numero_proforma, pp.nro_factura_importacion,
         COUNT(DISTINCT icp.intencion_compra_id)::int AS n_ics,
         COUNT(ppd.id)::int AS n_ppd,
         COALESCE(SUM(ppd.cantidad_pares), 0)::bigint AS pares,
         COALESCE(SUM(ppd.pares_vendidos), 0)::bigint AS vendidos
  FROM pedido_proveedor pp
  LEFT JOIN quincena_arribo qa ON qa.id = pp.quincena_arribo_id
  LEFT JOIN intencion_compra_pedido icp ON icp.pedido_proveedor_id = pp.id
  LEFT JOIN pedido_proveedor_detalle ppd ON ppd.pedido_proveedor_id = pp.id
  WHERE COALESCE(pp.categoria_id, (
    SELECT ic.categoria_id FROM intencion_compra_pedido x
    JOIN intencion_compra ic ON ic.id = x.intencion_compra_id
    WHERE x.pedido_proveedor_id = pp.id LIMIT 1
  )) = 2
  GROUP BY pp.id, qa.descripcion
  ORDER BY pp.id DESC
`);

const { rows: ic } = await client.query(`
  SELECT COUNT(*)::int total,
         COUNT(*) FILTER (WHERE estado='AUTORIZADO')::int autorizadas,
         COUNT(*) FILTER (WHERE estado='PENDIENTE_OPERATIVO')::int pendientes,
         COUNT(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM intencion_compra_pedido icp WHERE icp.intencion_compra_id = ic.id
         ))::int con_pp
  FROM intencion_compra ic WHERE ic.categoria_id = 2
`);

const { rows: web } = await client.query(`
  SELECT COUNT(*)::int filas, COALESCE(SUM(saldo_pares),0)::bigint saldo
  FROM v_stock_rimec WHERE origen_tipo = 'TRÁNSITO_PP'
`);

console.log(JSON.stringify({ pp_compra_previa: pp, ic_cp: ic[0], catalogo_transito: web[0] }, null, 2));
await client.end();
