import fs from "fs";
import pg from "pg";

const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const c = new pg.Client({ connectionString: url });
await c.connect();

const ppId = 26;
const eventoId = 45;

const sku = await c.query(
  `SELECT COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE l.id IS NOT NULL AND ref.id IS NOT NULL AND m.id IS NOT NULL)::int AS con_pilares,
          COUNT(*) FILTER (WHERE COALESCE(pl.lpn,0) > 0)::int AS con_lpn
   FROM pedido_proveedor_detalle ppd
   JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
   LEFT JOIN linea l ON l.proveedor_id = pp.proveedor_importacion_id AND l.codigo_proveedor::text = ppd.linea
   LEFT JOIN referencia ref ON ref.linea_id = l.id AND ref.codigo_proveedor::text = ppd.referencia
   LEFT JOIN material m ON m.proveedor_id = pp.proveedor_importacion_id AND m.codigo_proveedor::text = ppd.material_code
   LEFT JOIN precio_lista pl ON pl.evento_id = $2 AND pl.linea_id = l.id AND pl.referencia_id = ref.id AND pl.material_id = m.id
   WHERE ppd.pedido_proveedor_id = $1`,
  [ppId, eventoId],
);
console.log("PPD pilares/LPN:", sku.rows[0]);

const fiPlan = await c.query(
  `SELECT COUNT(DISTINCT ic.id)::int AS n_ic
   FROM intencion_compra_pedido icp
   JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
   WHERE icp.pedido_proveedor_id = $1`,
  [ppId],
);
console.log("ICs:", fiPlan.rows[0]);

await c.end();
