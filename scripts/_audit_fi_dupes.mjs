import pg from "pg";
import fs from "fs";

const pool = new pg.Pool({
  connectionString: fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim(),
});

const r = await pool.query(`
SELECT fi.id, COUNT(*)::int AS n
FROM factura_interna fi
LEFT JOIN cliente_v2 cv ON cv.id_cliente = fi.cliente_id
LEFT JOIN usuario_v2 uv ON uv.id_usuario = fi.vendedor_id
LEFT JOIN plazo_v2 pl ON pl.id_plazo = fi.plazo_id
LEFT JOIN LATERAL (
  SELECT ic.id_vendedor, ic.listado_precio_id, ic.id_plazo,
         ic.descuento_1, ic.descuento_2, ic.descuento_3, ic.descuento_4
  FROM intencion_compra_pedido icp
  JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
  WHERE icp.pedido_proveedor_id = fi.pp_id
    AND ic.id_cliente = fi.cliente_id
  LIMIT 1
) ic ON true
LEFT JOIN vendedor_v2 vd ON vd.id_vendedor = ic.id_vendedor
LEFT JOIN plazo_v2 pl_ic ON pl_ic.id_plazo = ic.id_plazo
WHERE fi.pp_id = 15
GROUP BY fi.id
HAVING COUNT(*) > 1
ORDER BY fi.id
`);
console.log("dupes from join:", r.rows);

const vd = await pool.query(`
SELECT vd.id_vendedor, COUNT(*)::int n
FROM factura_interna fi
LEFT JOIN LATERAL (
  SELECT ic.id_vendedor FROM intencion_compra_pedido icp
  JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
  WHERE icp.pedido_proveedor_id = fi.pp_id AND ic.id_cliente = fi.cliente_id LIMIT 1
) ic ON true
JOIN vendedor_v2 vd ON vd.id_vendedor = ic.id_vendedor
WHERE fi.pp_id = 15
GROUP BY vd.id_vendedor, fi.id
HAVING COUNT(*) > 1
`);
console.log("vendedor join dupes:", vd.rows);

const cv = await pool.query(`
SELECT fi.id, COUNT(*)::int n FROM factura_interna fi
JOIN cliente_v2 cv ON cv.id_cliente = fi.cliente_id
WHERE fi.pp_id = 15 GROUP BY fi.id HAVING COUNT(*) > 1
`);
console.log("cliente join dupes:", cv.rows);

const raw = await pool.query(`SELECT id, nro_factura, COUNT(*) FROM factura_interna WHERE pp_id=15 GROUP BY id, nro_factura`);
console.log("fi count:", raw.rowCount);

await pool.end();
