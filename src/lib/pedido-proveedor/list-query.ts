import type { Pool } from "pg";
import type { PpListaRow } from "./list-types";

export type { PpListaRow, PpQuincenaGrupo } from "./list-types";
export { groupPedidosPorQuincena } from "./list-types";

export async function listPedidosProveedor(pool: Pool): Promise<PpListaRow[]> {
  const { rows } = await pool.query<{
    id: string;
    numero_registro: string;
    estado: string;
    estado_digitacion: string | null;
    categoria_id: string | null;
    pares_comprometidos: string | null;
    total_vendido: string | null;
    proveedor: string;
    marcas: string;
    ics: string;
    n_ics: string;
    n_clientes: string;
    nro_fabrica: string;
    quincena: string | null;
    quincena_arribo_id: string | null;
    fecha_arribo_estimada: string | null;
    numero_proforma: string | null;
    cliente: string;
    vendedor: string;
    nro_factura_importacion: string | null;
    total_articulos: string;
    n_fi_confirmadas: string;
    n_facturas_internas: string;
  }>(`
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
             COUNT(DISTINCT ic.id)::int AS n_ics,
             COUNT(DISTINCT ic.id_cliente)::int AS n_clientes,
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
    ),
    fi_all AS (
      SELECT pp_id, COUNT(*)::int AS n_facturas_internas
      FROM factura_interna
      GROUP BY pp_id
    )
    SELECT pp.id, pp.numero_registro, pp.estado, pp.estado_digitacion,
           pp.categoria_id::text AS categoria_id,
           COALESCE(pp.pares_comprometidos, 0)::text AS pares_comprometidos,
           (COALESCE(vt.vendido_vt, 0) + COALESCE(ppd.vendido_ppd, 0))::text AS total_vendido,
           COALESCE(pi.nombre, '—') AS proveedor,
           pp.numero_proforma,
           pp.fecha_arribo_estimada::text AS fecha_arribo_estimada,
           pp.nro_factura_importacion,
           COALESCE(pp.quincena_arribo_id, icf.quincena_arribo_id)::text AS quincena_arribo_id,
           COALESCE(qa.descripcion, icf.quincena_ic, 'Sin fecha de embarque') AS quincena,
           COALESCE(mppd.marcas, mic.marcas, '—') AS marcas,
           COALESCE(ics.ics, ic_legacy.numero_registro, '—') AS ics,
           COALESCE(ics.n_ics, CASE WHEN ic_legacy.id IS NOT NULL THEN 1 ELSE 0 END, 0)::text AS n_ics,
           COALESCE(ics.n_clientes, CASE WHEN ic_legacy.id IS NOT NULL THEN 1 ELSE 0 END, 0)::text AS n_clientes,
           COALESCE(ics.nro_fabrica, '—') AS nro_fabrica,
           COALESCE(icf.cliente_ic, c.descp_cliente, '—') AS cliente,
           COALESCE(icf.vendedor_ic, v.descp_usuario, '—') AS vendedor,
           COALESCE(ppd.total_articulos, 0)::text AS total_articulos,
           COALESCE(fi.n_fi_confirmadas, 0)::text AS n_fi_confirmadas,
           COALESCE(fia.n_facturas_internas, 0)::text AS n_facturas_internas
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
    LEFT JOIN fi_all fia ON fia.pp_id = pp.id
    WHERE pp.estado IN ('ABIERTO', 'CERRADO', 'ANULADO', 'ENVIADO')
    ORDER BY COALESCE(pp.quincena_arribo_id, icf.quincena_arribo_id, 9999) ASC, pp.numero_registro ASC
  `);

  return rows.map((r) => ({
    id: Number(r.id),
    numero_registro: r.numero_registro,
    estado: r.estado,
    estado_digitacion: r.estado_digitacion,
    categoria_id: r.categoria_id != null ? Number(r.categoria_id) : null,
    pares_comprometidos: Number(r.pares_comprometidos ?? 0),
    total_vendido: Number(r.total_vendido ?? 0),
    proveedor: r.proveedor,
    marcas: r.marcas,
    ics: r.ics,
    n_ics: Number(r.n_ics ?? 0),
    n_clientes: Number(r.n_clientes ?? 0),
    nro_fabrica: r.nro_fabrica,
    quincena: r.quincena,
    quincena_arribo_id: r.quincena_arribo_id ? Number(r.quincena_arribo_id) : null,
    fecha_arribo_estimada: r.fecha_arribo_estimada,
    numero_proforma: r.numero_proforma,
    cliente: r.cliente,
    vendedor: r.vendedor,
    nro_factura_importacion: r.nro_factura_importacion,
    total_articulos: Number(r.total_articulos ?? 0),
    n_fi_confirmadas: Number(r.n_fi_confirmadas ?? 0),
    n_facturas_internas: Number(r.n_facturas_internas ?? 0),
  }));
}
