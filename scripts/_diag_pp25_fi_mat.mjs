import fs from "fs";
import pg from "pg";

const url = fs.readFileSync("c:/Users/hecto/Nexus_Core/report/.env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const c = new pg.Client({ connectionString: url });
await c.connect();

const ppd = await c.query(`
  SELECT SUM(cantidad_pares)::int AS tot, SUM(pares_vendidos)::int AS vend,
         COUNT(*) FILTER (WHERE pares_vendidos > 0)::int AS con_vend
  FROM pedido_proveedor_detalle WHERE pedido_proveedor_id = 25
`);

const mat = await c.query(`
  SELECT COUNT(*)::int AS n
  FROM pedido_proveedor_detalle ppd
  JOIN material m ON m.codigo_proveedor::text = ppd.material_code AND m.proveedor_id = 654
  WHERE ppd.pedido_proveedor_id = 25
    AND ppd.descp_material IS NOT NULL AND TRIM(ppd.descp_material) <> ''
    AND (m.descripcion IS NULL OR TRIM(m.descripcion) = '')
`);

const sku = await c.query(`
  SELECT COUNT(*)::int AS ppd_total,
         COUNT(*) FILTER (WHERE l.id IS NOT NULL AND ref.id IS NOT NULL AND mat.id IS NOT NULL)::int AS con_pilares,
         COUNT(*) FILTER (WHERE pl.lpn IS NOT NULL AND pl.lpn > 0)::int AS con_lpn
  FROM pedido_proveedor_detalle ppd
  JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
  LEFT JOIN linea l ON l.proveedor_id = pp.proveedor_importacion_id AND l.codigo_proveedor::text = ppd.linea
  LEFT JOIN referencia ref ON ref.linea_id = l.id AND ref.codigo_proveedor::text = ppd.referencia
  LEFT JOIN material mat ON mat.proveedor_id = pp.proveedor_importacion_id AND mat.codigo_proveedor::text = ppd.material_code
  LEFT JOIN precio_lista pl ON pl.evento_id = 37 AND pl.linea_id = l.id AND pl.referencia_id = ref.id AND pl.material_id = mat.id
  WHERE ppd.pedido_proveedor_id = 25
`);

console.log(JSON.stringify({ ppd: ppd.rows[0], matSinDesc: mat.rows[0], sku: sku.rows[0] }, null, 2));
await c.end();
