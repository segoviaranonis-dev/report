import type { Pool } from "pg";

export type PpListaRow = {
  id: number;
  numero_registro: string;
  estado: string;
  estado_digitacion: string | null;
  pares_comprometidos: number;
  total_vendido: number;
  proveedor: string;
  marcas: string;
  ics: string;
  nro_fabrica: string;
  quincena: string | null;
  quincena_arribo_id: number | null;
  fecha_arribo_estimada: string | null;
  numero_proforma: string | null;
  cliente: string;
  vendedor: string;
  nro_factura_importacion: string | null;
  total_articulos: number;
  n_fi_confirmadas: number;
};

export type PpQuincenaGrupo = {
  key: string;
  quincena: string;
  quincena_arribo_id: number | null;
  pedidos: PpListaRow[];
  n_preventas: number;
  total_pares: number;
  total_vendido: number;
  pct_ejecutado: number;
};

export async function listPedidosProveedor(pool: Pool): Promise<PpListaRow[]> {
  const { rows } = await pool.query<{
    id: string;
    numero_registro: string;
    estado: string;
    estado_digitacion: string | null;
    pares_comprometidos: string | null;
    total_vendido: string | null;
    proveedor: string;
    marcas: string;
    ics: string;
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
  }>(`
    SELECT pp.id, pp.numero_registro, pp.estado, pp.estado_digitacion,
           COALESCE(pp.pares_comprometidos, 0)::text AS pares_comprometidos,
           (
             COALESCE(
               (SELECT SUM(vt2.cantidad_vendida) FROM venta_transito vt2 WHERE vt2.pedido_proveedor_id = pp.id),
               0
             )
             + COALESCE(
               (SELECT SUM(ppd3.pares_vendidos) FROM pedido_proveedor_detalle ppd3 WHERE ppd3.pedido_proveedor_id = pp.id),
               0
             )
           )::text AS total_vendido,
           COALESCE(pi.nombre, '—') AS proveedor,
           pp.numero_proforma,
           pp.fecha_arribo_estimada::text AS fecha_arribo_estimada,
           pp.nro_factura_importacion,
           COALESCE(
             pp.quincena_arribo_id,
             (SELECT ic0.quincena_arribo_id
              FROM intencion_compra_pedido icp0
              JOIN intencion_compra ic0 ON ic0.id = icp0.intencion_compra_id
              WHERE icp0.pedido_proveedor_id = pp.id
              ORDER BY ic0.numero_registro
              LIMIT 1)
           )::text AS quincena_arribo_id,
           COALESCE(
             qa.descripcion,
             (SELECT qa2.descripcion
              FROM intencion_compra_pedido icp_q
              JOIN intencion_compra ic_q ON ic_q.id = icp_q.intencion_compra_id
              JOIN quincena_arribo qa2 ON qa2.id = ic_q.quincena_arribo_id
              WHERE icp_q.pedido_proveedor_id = pp.id
              ORDER BY ic_q.numero_registro
              LIMIT 1),
             'Sin fecha de embarque'
           ) AS quincena,
           COALESCE(
             (SELECT STRING_AGG(DISTINCT mv.descp_marca, ' / ' ORDER BY mv.descp_marca)
              FROM pedido_proveedor_detalle ppd
              JOIN marca_v2 mv ON mv.id_marca = ppd.id_marca
              WHERE ppd.pedido_proveedor_id = pp.id AND ppd.linea IS NOT NULL),
             (SELECT STRING_AGG(DISTINCT mv.descp_marca, ' / ' ORDER BY mv.descp_marca)
              FROM intencion_compra_pedido icp
              JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
              JOIN marca_v2 mv ON mv.id_marca = ic.id_marca
              WHERE icp.pedido_proveedor_id = pp.id),
             '—'
           ) AS marcas,
           COALESCE(
             (SELECT STRING_AGG(DISTINCT ic.numero_registro, ', ' ORDER BY ic.numero_registro)
              FROM intencion_compra_pedido icp
              JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
              WHERE icp.pedido_proveedor_id = pp.id),
             ic_legacy.numero_registro,
             '—'
           ) AS ics,
           COALESCE(
             (SELECT STRING_AGG(DISTINCT icp.nro_pedido_fabrica, ' · ' ORDER BY icp.nro_pedido_fabrica)
              FROM intencion_compra_pedido icp
              WHERE icp.pedido_proveedor_id = pp.id AND NULLIF(TRIM(icp.nro_pedido_fabrica), '') IS NOT NULL),
             '—'
           ) AS nro_fabrica,
           COALESCE(
             c.descp_cliente,
             (SELECT c2.descp_cliente
              FROM intencion_compra_pedido icp_c
              JOIN intencion_compra ic_c ON ic_c.id = icp_c.intencion_compra_id
              JOIN cliente_v2 c2 ON c2.id_cliente = ic_c.id_cliente
              WHERE icp_c.pedido_proveedor_id = pp.id
              LIMIT 1),
             '—'
           ) AS cliente,
           COALESCE(
             v.descp_usuario,
             (SELECT v2.descp_usuario
              FROM intencion_compra_pedido icp_v
              JOIN intencion_compra ic_v ON ic_v.id = icp_v.intencion_compra_id
              JOIN usuario_v2 v2 ON v2.id_usuario = ic_v.id_vendedor
              WHERE icp_v.pedido_proveedor_id = pp.id
              LIMIT 1),
             '—'
           ) AS vendedor,
           (SELECT COUNT(*)::text
            FROM pedido_proveedor_detalle ppd_cnt
            WHERE ppd_cnt.pedido_proveedor_id = pp.id AND ppd_cnt.linea IS NOT NULL) AS total_articulos,
           (SELECT COUNT(*)::text
            FROM factura_interna fi_c
            WHERE fi_c.pp_id = pp.id AND fi_c.estado = 'CONFIRMADA') AS n_fi_confirmadas
    FROM pedido_proveedor pp
    LEFT JOIN proveedor_importacion pi ON pi.id = pp.proveedor_importacion_id
    LEFT JOIN intencion_compra ic_legacy ON ic_legacy.id = pp.id_intencion_compra
    LEFT JOIN quincena_arribo qa ON qa.id = pp.quincena_arribo_id
    LEFT JOIN cliente_v2 c ON c.id_cliente = ic_legacy.id_cliente
    LEFT JOIN usuario_v2 v ON v.id_usuario = ic_legacy.id_vendedor
    WHERE pp.estado IN ('ABIERTO', 'CERRADO', 'ANULADO', 'ENVIADO')
    ORDER BY
      COALESCE(
        pp.quincena_arribo_id,
        (SELECT ic_s.quincena_arribo_id
         FROM intencion_compra_pedido icp_s
         JOIN intencion_compra ic_s ON ic_s.id = icp_s.intencion_compra_id
         WHERE icp_s.pedido_proveedor_id = pp.id
         LIMIT 1),
        9999
      ) ASC,
      pp.numero_registro ASC
  `);

  return rows.map((r) => ({
    id: Number(r.id),
    numero_registro: r.numero_registro,
    estado: r.estado,
    estado_digitacion: r.estado_digitacion,
    pares_comprometidos: Number(r.pares_comprometidos ?? 0),
    total_vendido: Number(r.total_vendido ?? 0),
    proveedor: r.proveedor,
    marcas: r.marcas,
    ics: r.ics,
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
  }));
}

/** Agrupa PP por FECHA DE EMBARQUE (quincena_arribo / dato duro). */
export function groupPedidosPorQuincena(pedidos: PpListaRow[]): PpQuincenaGrupo[] {
  const map = new Map<string, PpQuincenaGrupo>();

  for (const p of pedidos) {
    const quincena = p.quincena?.trim() || "Sin fecha de embarque";
    const key = p.quincena_arribo_id != null ? `q-${p.quincena_arribo_id}` : `z-${quincena}`;

    let g = map.get(key);
    if (!g) {
      g = {
        key,
        quincena,
        quincena_arribo_id: p.quincena_arribo_id,
        pedidos: [],
        n_preventas: 0,
        total_pares: 0,
        total_vendido: 0,
        pct_ejecutado: 0,
      };
      map.set(key, g);
    }
    g.pedidos.push(p);
    g.n_preventas += 1;
    g.total_pares += p.pares_comprometidos;
    g.total_vendido += p.total_vendido;
  }

  const grupos = [...map.values()].map((g) => ({
    ...g,
    pct_ejecutado: g.total_pares > 0 ? Math.round((g.total_vendido / g.total_pares) * 1000) / 10 : 0,
  }));

  grupos.sort((a, b) => {
    const sa = a.quincena_arribo_id ?? 9999;
    const sb = b.quincena_arribo_id ?? 9999;
    if (sa !== sb) return sa - sb;
    return a.quincena.localeCompare(b.quincena, "es");
  });

  return grupos;
}
