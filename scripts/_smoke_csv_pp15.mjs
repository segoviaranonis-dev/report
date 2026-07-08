import pg from "pg";
import fs from "node:fs";

const env = fs.readFileSync("c:/Users/hecto/Nexus_Core/report/.env.local", "utf8");
const m = env.match(/^DATABASE_URL=(.+)$/m);
if (!m) throw new Error("no DATABASE_URL");
const pool = new pg.Pool({ connectionString: m[1].trim().replace(/^"|"$/g, "") });

const q = `
SELECT fi.cliente_id, ppd.grades_json, pl.nombre_caso_aplicado AS caso,
       pe_evt.evento_nombre AS biblioteca,
       COALESCE(NULLIF(TRIM(ge.descp_grupo_estilo), ''), lr.grupo_estilo_id::text) AS estilo
FROM factura_interna fi
JOIN factura_interna_detalle fid ON fid.factura_id = fi.id
JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
JOIN pedido_proveedor pp ON pp.id = fi.pp_id
LEFT JOIN material m ON m.proveedor_id = pp.proveedor_importacion_id AND m.codigo_proveedor::text = ppd.material_code
LEFT JOIN linea l ON l.proveedor_id = pp.proveedor_importacion_id AND l.codigo_proveedor::text = ppd.linea
LEFT JOIN referencia ref ON ref.codigo_proveedor::text = ppd.referencia AND ref.linea_id = l.id
LEFT JOIN linea_referencia lr ON lr.linea_id = l.id AND lr.referencia_id = ref.id
LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = lr.grupo_estilo_id
LEFT JOIN LATERAL (
  SELECT icp.precio_evento_id FROM intencion_compra_pedido icp
  WHERE icp.pedido_proveedor_id = fi.pp_id AND icp.precio_evento_id IS NOT NULL
  ORDER BY icp.id LIMIT 1
) icp ON TRUE
LEFT JOIN LATERAL (
  SELECT pe.nombre_evento AS evento_nombre FROM precio_evento pe
  WHERE pe.id = icp.precio_evento_id LIMIT 1
) pe_evt ON TRUE
LEFT JOIN precio_lista pl ON pl.evento_id = icp.precio_evento_id
  AND pl.linea_id = l.id AND pl.referencia_id = ref.id AND pl.material_id = m.id
WHERE fi.pp_id = 15 AND fi.estado = ANY(ARRAY['RESERVADA','CONFIRMADA']::text[])
LIMIT 2
`;

try {
  const { rows } = await pool.query(q);
  console.log("OK", rows);
} catch (e) {
  console.error("FAIL", e.message);
} finally {
  await pool.end();
}
