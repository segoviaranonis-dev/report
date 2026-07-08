import { getRimecPool } from "@/lib/rimec/pool";
import type { OrigenFacturacion, OrigenStockCanon } from "./filters";
import { SQL_FI_ES_PE, SQL_FI_ES_TRANSITO } from "./filters";
import type { FacturaKpis, FacturaListItem } from "./types";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const FILTRO_CL_BASE = `
  AND fi.pp_id IN (
    SELECT clp.pedido_proveedor_id FROM compra_legal_pedido clp
    JOIN compra_legal cl ON cl.id = clp.compra_legal_id
    WHERE cl.estado IN ('DISTRIBUIDA', 'CERRADA')
  )
`;

const FILTRO_VT_BASE = `
  AND vt.pedido_proveedor_id IN (
    SELECT clp.pedido_proveedor_id FROM compra_legal_pedido clp
    JOIN compra_legal cl ON cl.id = clp.compra_legal_id
    WHERE cl.estado IN ('DISTRIBUIDA', 'CERRADA')
  )
`;

function mapRows(rows: FacturaListItem[]): FacturaListItem[] {
  return rows.map((r) => ({
    ...r,
    pares: num(r.pares),
    pv_global: r.pv_global != null ? num(r.pv_global) : null,
    pp_id: r.pp_id != null ? num(r.pp_id) : null,
    traspaso_id: r.traspaso_id != null ? num(r.traspaso_id) : null,
  }));
}

/** Bandeja tránsito / proceso — circuito Compra Legal (contenido histórico). */
export async function getFacturasTransito(idCl?: number | null): Promise<FacturaListItem[]> {
  const pool = getRimecPool();
  const params: unknown[] = [];
  let filtroVt = FILTRO_VT_BASE;
  let filtroFi = FILTRO_CL_BASE;

  if (idCl != null) {
    params.push(idCl);
    filtroVt = `
      AND vt.pedido_proveedor_id IN (
        SELECT clp.pedido_proveedor_id FROM compra_legal_pedido clp
        JOIN compra_legal cl ON cl.id = clp.compra_legal_id
        WHERE clp.compra_legal_id = $1 AND cl.estado IN ('DISTRIBUIDA', 'CERRADA')
      )
    `;
    filtroFi = `
      AND fi.pp_id IN (
        SELECT clp.pedido_proveedor_id FROM compra_legal_pedido clp
        JOIN compra_legal cl ON cl.id = clp.compra_legal_id
        WHERE clp.compra_legal_id = $1 AND cl.estado IN ('DISTRIBUIDA', 'CERRADA')
      )
      AND ${SQL_FI_ES_TRANSITO}
    `;
  } else {
    filtroFi = `${FILTRO_CL_BASE} AND ${SQL_FI_ES_TRANSITO}`;
  }

  const { rows } = await pool.query<FacturaListItem>(
    `
    SELECT factura, factura_legacy, pv_global, pp_id, pedido, proforma, marca, fecha::text AS fecha,
           cliente, codigo_cliente, pares::int, compra, compra_id, traspaso_estado, traspaso_id,
           origen_stock, fi_estado, total_monto
    FROM (
      SELECT vt.numero_factura_interna AS factura,
             vt.numero_factura_interna AS factura_legacy,
             NULL::int AS pv_global,
             vt.pedido_proveedor_id AS pp_id,
             pp.numero_registro AS pedido, pp.numero_proforma AS proforma,
             COALESCE(mv.descp_marca, '—') AS marca,
             MIN(vt.fecha_operacion)::text AS fecha,
             COALESCE(cv.descp_cliente, vt.codigo_cliente::text) AS cliente,
             vt.codigo_cliente::text AS codigo_cliente,
             SUM(vt.cantidad_vendida) AS pares,
             COALESCE(cl.numero_registro, '—') AS compra,
             COALESCE(cl.id::text, '') AS compra_id,
             COALESCE((SELECT t.estado FROM traspaso t WHERE t.documento_ref = vt.numero_factura_interna LIMIT 1), 'SIN_TRASPASO') AS traspaso_estado,
             (SELECT t.id FROM traspaso t WHERE t.documento_ref = vt.numero_factura_interna LIMIT 1) AS traspaso_id,
             'PROCESO_PP'::text AS origen_stock,
             'CONFIRMADA'::text AS fi_estado,
             NULL::numeric AS total_monto
      FROM venta_transito vt
      JOIN pedido_proveedor pp ON pp.id = vt.pedido_proveedor_id
      JOIN pedido_proveedor_detalle ppd ON ppd.id = vt.pedido_proveedor_detalle_id
      LEFT JOIN marca_v2 mv ON mv.id_marca = ppd.id_marca
      LEFT JOIN cliente_v2 cv ON cv.id_cliente::text = vt.codigo_cliente::text
      LEFT JOIN compra_legal_pedido clp ON clp.pedido_proveedor_id = vt.pedido_proveedor_id
      LEFT JOIN compra_legal cl ON cl.id = clp.compra_legal_id
      WHERE 1=1 ${filtroVt}
      GROUP BY vt.numero_factura_interna, pp.numero_registro, pp.numero_proforma,
               mv.descp_marca, vt.codigo_cliente, cv.descp_cliente, cl.numero_registro, cl.id

      UNION ALL

      SELECT CASE WHEN fi.pv_global IS NOT NULL THEN 'PV' || LPAD(fi.pv_global::text, 6, '0') ELSE fi.nro_factura END AS factura,
             fi.nro_factura AS factura_legacy,
             fi.pv_global::int AS pv_global,
             fi.pp_id,
             pp.numero_registro AS pedido, pp.numero_proforma AS proforma,
             COALESCE(mv.descp_marca, fi.marca, '—') AS marca,
             fi.created_at::date::text AS fecha,
             COALESCE(cv.descp_cliente, fi.cliente_id::text) AS cliente,
             fi.cliente_id::text AS codigo_cliente,
             SUM(fid.pares) AS pares,
             COALESCE(cl.numero_registro, '—') AS compra,
             COALESCE(cl.id::text, '') AS compra_id,
             COALESCE((SELECT t.estado FROM traspaso t WHERE t.documento_ref = fi.nro_factura LIMIT 1), 'SIN_TRASPASO') AS traspaso_estado,
             (SELECT t.id FROM traspaso t WHERE t.documento_ref = fi.nro_factura LIMIT 1) AS traspaso_id,
             'PROCESO_PP'::text AS origen_stock,
             fi.estado AS fi_estado,
             fi.total_monto
      FROM factura_interna fi
      JOIN factura_interna_detalle fid ON fid.factura_id = fi.id
      JOIN pedido_proveedor pp ON pp.id = fi.pp_id
      JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
      LEFT JOIN marca_v2 mv ON mv.id_marca = ppd.id_marca
      LEFT JOIN cliente_v2 cv ON cv.id_cliente = fi.cliente_id
      LEFT JOIN compra_legal_pedido clp ON clp.pedido_proveedor_id = fi.pp_id
      LEFT JOIN compra_legal cl ON cl.id = clp.compra_legal_id
      WHERE fi.estado IN ('CONFIRMADA', 'RESERVADA') ${filtroFi}
      GROUP BY fi.pv_global, fi.nro_factura, pp.numero_registro, pp.numero_proforma,
               mv.descp_marca, fi.marca, fi.cliente_id, cv.descp_cliente, cl.numero_registro, cl.id,
               fi.created_at, fi.estado, fi.total_monto
    ) u
    ORDER BY fecha DESC NULLS LAST, factura
    `,
    params,
  );

  return mapRows(rows);
}

/** Bandeja Pronta entrega — FI enlazada a pedido_proveedor_detalle · sin Compra Legal. */
export async function getFacturasProntaEntrega(): Promise<FacturaListItem[]> {
  const pool = getRimecPool();

  const { rows } = await pool.query<FacturaListItem>(
    `
    SELECT
      CASE WHEN fi.pv_global IS NOT NULL THEN 'PV' || LPAD(fi.pv_global::text, 6, '0') ELSE fi.nro_factura END AS factura,
      fi.nro_factura AS factura_legacy,
      fi.pv_global::int AS pv_global,
      fi.pp_id,
      COALESCE(pp.numero_registro, 'Pronta entrega') AS pedido,
      COALESCE(pp.numero_proforma, '—') AS proforma,
      COALESCE(mv.descp_marca, fi.marca, '—') AS marca,
      fi.created_at::date::text AS fecha,
      COALESCE(cv.descp_cliente, fi.cliente_id::text) AS cliente,
      fi.cliente_id::text AS codigo_cliente,
      SUM(fid.pares)::int AS pares,
      '—' AS compra,
      '' AS compra_id,
      COALESCE((SELECT t.estado FROM traspaso t WHERE t.documento_ref = fi.nro_factura LIMIT 1), 'SIN_TRASPASO') AS traspaso_estado,
      (SELECT t.id FROM traspaso t WHERE t.documento_ref = fi.nro_factura LIMIT 1) AS traspaso_id,
      'STOCK_IMPORTADO'::text AS origen_stock,
      fi.estado AS fi_estado,
      fi.total_monto
    FROM factura_interna fi
    JOIN factura_interna_detalle fid ON fid.factura_id = fi.id
    LEFT JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
    LEFT JOIN pedido_proveedor pp ON pp.id = fi.pp_id
    LEFT JOIN marca_v2 mv ON mv.id_marca = COALESCE(ppd.id_marca, fi.marca_id)
    LEFT JOIN cliente_v2 cv ON cv.id_cliente = fi.cliente_id
    WHERE fi.estado IN ('CONFIRMADA', 'RESERVADA')
      AND ${SQL_FI_ES_PE}
    GROUP BY fi.id, fi.pv_global, fi.nro_factura, pp.numero_registro, pp.numero_proforma,
             mv.descp_marca, fi.marca, fi.cliente_id, cv.descp_cliente, fi.created_at, fi.estado, fi.total_monto
    ORDER BY fi.created_at::date DESC NULLS LAST, fi.nro_factura DESC
    `,
  );

  return mapRows(rows);
}

export async function getFacturas(
  idCl?: number | null,
  origen: OrigenFacturacion = "transito",
): Promise<FacturaListItem[]> {
  if (origen === "pronta-entrega") return getFacturasProntaEntrega();
  return getFacturasTransito(idCl);
}

export function summarizeFacturas(items: FacturaListItem[]): FacturaKpis {
  return {
    total: items.length,
    sin_traspaso: items.filter((f) => f.traspaso_estado === "SIN_TRASPASO").length,
    borrador: items.filter((f) => f.traspaso_estado === "BORRADOR").length,
    enviado: items.filter((f) => f.traspaso_estado === "ENVIADO").length,
    confirmado: items.filter((f) => f.traspaso_estado === "CONFIRMADO").length,
    total_pares: items.reduce((a, f) => a + f.pares, 0),
    reservadas: items.filter((f) => f.fi_estado === "RESERVADA").length,
    confirmadas_fi: items.filter((f) => f.fi_estado === "CONFIRMADA").length,
  };
}

export type { OrigenStockCanon };

