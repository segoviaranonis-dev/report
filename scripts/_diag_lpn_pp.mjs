import fs from "fs";
import pg from "pg";

const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const c = new pg.Client({ connectionString: url });
await c.connect();

for (const ppId of [26, 28]) {
  const r = await c.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE sku.linea_id IS NOT NULL AND COALESCE(sku.lpn,0)>0)::int AS con_lpn
     FROM pedido_proveedor_detalle ppd
     JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
     LEFT JOIN LATERAL (
       SELECT l.id AS linea_id, pl.lpn
       FROM linea l
       LEFT JOIN referencia ref ON ref.linea_id = l.id AND ref.codigo_proveedor::text = ppd.referencia
       LEFT JOIN material m ON m.proveedor_id = pp.proveedor_importacion_id AND m.codigo_proveedor::text = ppd.material_code
       LEFT JOIN precio_lista pl ON pl.evento_id = 45 AND pl.linea_id = l.id
         AND pl.referencia_id = ref.id AND pl.material_id = m.id
       WHERE l.proveedor_id = pp.proveedor_importacion_id AND l.codigo_proveedor::text = ppd.linea
       LIMIT 1
     ) sku ON true
     WHERE ppd.pedido_proveedor_id = $1`,
    [ppId],
  );
  console.log("PP", ppId, r.rows[0]);
}

const bad = await c.query(
  `SELECT ppd.id, ppd.linea, ppd.referencia, ppd.material_code, pp.numero_registro
   FROM pedido_proveedor_detalle ppd
   JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
   LEFT JOIN linea l ON l.proveedor_id = pp.proveedor_importacion_id AND l.codigo_proveedor::text = ppd.linea
   LEFT JOIN referencia ref ON ref.linea_id = l.id AND ref.codigo_proveedor::text = ppd.referencia
   LEFT JOIN material m ON m.proveedor_id = pp.proveedor_importacion_id AND m.codigo_proveedor::text = ppd.material_code
   LEFT JOIN precio_lista pl ON pl.evento_id = 45 AND pl.linea_id = l.id AND pl.referencia_id = ref.id AND pl.material_id = m.id
   WHERE ppd.id = 26111`,
);
console.log("PPD 26111", bad.rows[0]);

await c.end();
