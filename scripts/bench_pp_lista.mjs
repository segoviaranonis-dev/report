import pg from "pg";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("NO DATABASE_URL");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
const t0 = Date.now();

const { rows } = await pool.query(`
    WITH vt_agg AS (
      SELECT pedido_proveedor_id, COALESCE(SUM(cantidad_vendida), 0)::bigint AS vendido_vt
      FROM venta_transito
      GROUP BY pedido_proveedor_id
    ),
    ppd_agg AS (
      SELECT pedido_proveedor_id,
             COALESCE(SUM(pares_vendidos), 0)::bigint AS vendido_ppd,
             COUNT(*) FILTER (WHERE linea IS NOT NULL)::int AS total_articulos
      FROM pedido_proveedor_detalle
      GROUP BY pedido_proveedor_id
    ),
    ic_first AS (
      SELECT DISTINCT ON (icp.pedido_proveedor_id)
        icp.pedido_proveedor_id,
        ic.quincena_arribo_id,
        ic.numero_registro AS ic_nro,
        c.descp_cliente AS cliente_ic,
        v.descp_usuario AS vendedor_ic,
        qa.descripcion AS quincena_ic
      FROM intencion_compra_pedido icp
      JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
      LEFT JOIN cliente_v2 c ON c.id_cliente = ic.id_cliente
      LEFT JOIN usuario_v2 v ON v.id_usuario = ic.id_vendedor
      LEFT JOIN quincena_arribo qa ON qa.id = ic.quincena_arribo_id
      ORDER BY icp.pedido_proveedor_id, ic.numero_registro
    ),
    ics_agg AS (
      SELECT icp.pedido_proveedor_id,
             STRING_AGG(DISTINCT ic.numero_registro, ', ' ORDER BY ic.numero_registro) AS ics,
             STRING_AGG(
               DISTINCT NULLIF(TRIM(icp.nro_pedido_fabrica), ''),
               ' · ' ORDER BY NULLIF(TRIM(icp.nro_pedido_fabrica), '')
             ) AS nro_fabrica
      FROM intencion_compra_pedido icp
      JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
      GROUP BY icp.pedido_proveedor_id
    ),
    marcas_ppd AS (
      SELECT ppd.pedido_proveedor_id,
             STRING_AGG(DISTINCT mv.descp_marca, ' / ' ORDER BY mv.descp_marca) AS marcas
      FROM pedido_proveedor_detalle ppd
      JOIN marca_v2 mv ON mv.id_marca = ppd.id_marca
      WHERE ppd.linea IS NOT NULL
      GROUP BY ppd.pedido_proveedor_id
    ),
    marcas_ic AS (
      SELECT icp.pedido_proveedor_id,
             STRING_AGG(DISTINCT mv.descp_marca, ' / ' ORDER BY mv.descp_marca) AS marcas
      FROM intencion_compra_pedido icp
      JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
      JOIN marca_v2 mv ON mv.id_marca = ic.id_marca
      GROUP BY icp.pedido_proveedor_id
    ),
    fi_conf AS (
      SELECT pp_id, COUNT(*)::int AS n_fi_confirmadas
      FROM factura_interna
      WHERE estado = 'CONFIRMADA'
      GROUP BY pp_id
    )
    SELECT pp.id, pp.numero_registro
    FROM pedido_proveedor pp
    LEFT JOIN proveedor_importacion pi ON pi.id = pp.proveedor_importacion_id
    LEFT JOIN intencion_compra ic_legacy ON ic_legacy.id = pp.id_intencion_compra
    LEFT JOIN quincena_arribo qa ON qa.id = pp.quincena_arribo_id
    LEFT JOIN cliente_v2 c ON c.id_cliente = ic_legacy.id_cliente
    LEFT JOIN usuario_v2 v ON v.id_usuario = ic_legacy.id_vendedor
    LEFT JOIN vt_agg vt ON vt.pedido_proveedor_id = pp.id
    LEFT JOIN ppd_agg ppd ON ppd.pedido_proveedor_id = pp.id
    LEFT JOIN ic_first icf ON icf.pedido_proveedor_id = pp.id
    LEFT JOIN ics_agg ics ON ics.pedido_proveedor_id = pp.id
    LEFT JOIN marcas_ppd mppd ON mppd.pedido_proveedor_id = pp.id
    LEFT JOIN marcas_ic mic ON mic.pedido_proveedor_id = pp.id
    LEFT JOIN fi_conf fi ON fi.pp_id = pp.id
    WHERE pp.estado IN ('ABIERTO', 'CERRADO', 'ANULADO', 'ENVIADO')
    ORDER BY COALESCE(pp.quincena_arribo_id, icf.quincena_arribo_id, 9999) ASC, pp.numero_registro ASC
`);

console.log("rows", rows.length, "ms", Date.now() - t0);
await pool.end();
