import pg from "pg";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const m = env.match(/^DATABASE_URL=(.+)$/m);
const pool = new pg.Pool({ connectionString: m[1].trim() });

const cols = await pool.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'intencion_compra'
  ORDER BY ordinal_position
`);
console.log("IC cols:", cols.rows.map((r) => r.column_name).join(", "));

const q = await pool.query(`
SELECT fi.id, fi.nro_factura,
       COALESCE(vd.descp_vendedor, uv.descp_usuario) AS vendedor,
       COALESCE(pl.descp_plazo, pl_ic.descp_plazo) AS plazo,
       (SELECT SUM(cajas) FROM factura_interna_detalle WHERE factura_id=fi.id) AS cajas
FROM factura_interna fi
LEFT JOIN usuario_v2 uv ON uv.id_usuario = fi.vendedor_id
LEFT JOIN plazo_v2 pl ON pl.id_plazo = fi.plazo_id
LEFT JOIN LATERAL (
  SELECT ic.id_vendedor, ic.id_plazo
  FROM intencion_compra_pedido icp
  JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
  WHERE icp.pedido_proveedor_id = fi.pp_id AND ic.id_cliente = fi.cliente_id
  LIMIT 1
) ic ON true
LEFT JOIN vendedor_v2 vd ON vd.id_vendedor = ic.id_vendedor
LEFT JOIN plazo_v2 pl_ic ON pl_ic.id_plazo = ic.id_plazo
WHERE fi.pp_id = 15
ORDER BY fi.nro_factura
LIMIT 2
`);
console.log(JSON.stringify(q.rows, null, 2));

await pool.end();
