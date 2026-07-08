import pg from "pg";
import fs from "fs";

const pool = new pg.Pool({
  connectionString: fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim(),
});

await pool.query(`
UPDATE factura_interna fi
SET vendedor_id = NULL
FROM intencion_compra_pedido icp
JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
JOIN vendedor_v2 vd ON vd.id_vendedor = ic.id_vendedor
WHERE icp.pedido_proveedor_id = fi.pp_id
  AND ic.id_cliente = fi.cliente_id
  AND fi.pp_id = 15
  AND vd.usuario_id IS NULL
  AND fi.vendedor_id IS NOT NULL
`);

const r = await pool.query(`
SELECT fi.id, fi.vendedor_id, vd.descp_vendedor AS vendedor_ic
FROM factura_interna fi
LEFT JOIN LATERAL (
  SELECT ic.id_vendedor FROM intencion_compra_pedido icp
  JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
  WHERE icp.pedido_proveedor_id = fi.pp_id AND ic.id_cliente = fi.cliente_id LIMIT 1
) ic ON true
LEFT JOIN vendedor_v2 vd ON vd.id_vendedor = ic.id_vendedor
WHERE fi.pp_id = 15
ORDER BY fi.nro_factura
LIMIT 3
`);
console.log(JSON.stringify(r.rows, null, 2));
await pool.end();
