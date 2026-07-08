import pg from "pg";
import fs from "fs";

const pool = new pg.Pool({
  connectionString: fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim(),
});

const r = await pool.query(
  `
  SELECT
    fi.id, fi.marca, fi.caso,
    COALESCE(vd.descp_vendedor, v.descp_usuario) as vendedor_nombre,
    COALESCE(pl.descp_plazo, pl_ic.descp_plazo) as plazo_nombre,
    fi.lista_precio_id,
    fi.descuento_1, fi.descuento_2, fi.descuento_3, fi.descuento_4,
    ic.id_vendedor, ic.id_plazo
  FROM factura_interna fi
  LEFT JOIN usuario_v2 v ON v.id_usuario = fi.vendedor_id
  LEFT JOIN plazo_v2 pl ON pl.id_plazo = fi.plazo_id
  LEFT JOIN LATERAL (
    SELECT ic.id_vendedor, ic.id_plazo, ic.descuento_1, ic.descuento_2
    FROM intencion_compra_pedido icp
    JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
    WHERE icp.pedido_proveedor_id = fi.pp_id AND ic.id_cliente = fi.cliente_id
    LIMIT 1
  ) ic ON true
  LEFT JOIN vendedor_v2 vd ON vd.id_vendedor = ic.id_vendedor
  LEFT JOIN plazo_v2 pl_ic ON pl_ic.id_plazo = ic.id_plazo
  WHERE fi.id = 242
  `,
);
console.log(JSON.stringify(r.rows[0], null, 2));
await pool.end();
