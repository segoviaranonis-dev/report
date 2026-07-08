import pg from "pg";
import fs from "fs";

const pool = new pg.Pool({
  connectionString: fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim(),
});

const r = await pool.query(`
SELECT
  COALESCE(NULLIF(TRIM(fi.marca), ''), mv.descp_marca, '—') as marca,
  COALESCE(NULLIF(TRIM(vd.descp_vendedor), ''), '—') as vendedor,
  COALESCE(NULLIF(TRIM(pl.descp_plazo), ''), NULLIF(TRIM(pl_ic.descp_plazo), ''), '—') as plazo,
  fi.descuento_1, fi.descuento_2, fi.lista_precio_id, ic.listado_precio_id
FROM factura_interna fi
LEFT JOIN plazo_v2 pl ON pl.id_plazo = fi.plazo_id
LEFT JOIN LATERAL (
  SELECT ic.id_vendedor, ic.id_plazo, ic.id_marca, ic.listado_precio_id
  FROM intencion_compra_pedido icp
  JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
  WHERE icp.pedido_proveedor_id = fi.pp_id AND ic.id_cliente = fi.cliente_id LIMIT 1
) ic ON true
LEFT JOIN vendedor_v2 vd ON vd.id_vendedor = ic.id_vendedor
LEFT JOIN plazo_v2 pl_ic ON pl_ic.id_plazo = COALESCE(fi.plazo_id, ic.id_plazo)
LEFT JOIN marca_v2 mv ON mv.id_marca = ic.id_marca
WHERE fi.id = 242
`);
console.log(r.rows[0]);
await pool.end();
