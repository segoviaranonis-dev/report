import { getRimecPool } from "@/lib/rimec/pool";
import type {
  CompraLegalHeader,
  CompraLegalListItem,
  DepositoHijaRow,
  FiDeCompraRow,
  PpDeCompra,
} from "./types";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function getComprasLegales(): Promise<CompraLegalListItem[]> {
  const pool = getRimecPool();
  const { rows } = await pool.query<CompraLegalListItem>(
    `
    SELECT
      cl.id,
      cl.numero_registro,
      cl.numero_factura_proveedor AS proforma_referencia,
      cl.fecha_factura::text AS fecha_factura,
      cl.estado,
      COALESCE(
        (SELECT STRING_AGG(DISTINCT pp.numero_registro, ' / ' ORDER BY pp.numero_registro)
         FROM compra_legal_pedido clp
         JOIN pedido_proveedor pp ON pp.id = clp.pedido_proveedor_id
         WHERE clp.compra_legal_id = cl.id),
        '—'
      ) AS pps_vinculados,
      COALESCE(
        (SELECT SUM(pp2.pares_comprometidos)
         FROM compra_legal_pedido clp2
         JOIN pedido_proveedor pp2 ON pp2.id = clp2.pedido_proveedor_id
         WHERE clp2.compra_legal_id = cl.id),
        0
      )::int AS total_pares,
      (SELECT COUNT(*)::int FROM traspaso t WHERE t.compra_legal_id = cl.id) AS n_traspasos,
      (SELECT COUNT(*)::int FROM traspaso t WHERE t.compra_legal_id = cl.id AND t.estado = 'CONFIRMADO') AS n_confirmados
    FROM compra_legal cl
    ORDER BY cl.fecha_factura DESC NULLS LAST, cl.id DESC
    `,
  );
  return rows.map((r) => ({
    ...r,
    total_pares: num(r.total_pares),
    n_traspasos: num(r.n_traspasos),
    n_confirmados: num(r.n_confirmados),
  }));
}

export async function getMetricasFacturacionCompra(idCl: number) {
  const pool = getRimecPool();
  const { rows } = await pool.query<{ total_pares_f9: number; pares_facturados: number }>(
    `
    WITH pps AS (
      SELECT pedido_proveedor_id AS pp_id FROM compra_legal_pedido WHERE compra_legal_id = $1
    ),
    fi_pp AS (
      SELECT fi.pp_id, COALESCE(SUM(fid.pares), 0)::bigint AS pares_fi
      FROM factura_interna fi
      JOIN factura_interna_detalle fid ON fid.factura_id = fi.id
      WHERE fi.pp_id IN (SELECT pp_id FROM pps)
        AND fi.estado IN ('CONFIRMADA', 'RESERVADA')
      GROUP BY fi.pp_id
    ),
    vt_pp AS (
      SELECT vt.pedido_proveedor_id AS pp_id, COALESCE(SUM(vt.cantidad_vendida), 0)::bigint AS pares_vt
      FROM venta_transito vt
      WHERE vt.pedido_proveedor_id IN (SELECT pp_id FROM pps)
        AND NOT EXISTS (
          SELECT 1 FROM factura_interna fi
          WHERE fi.pp_id = vt.pedido_proveedor_id AND fi.nro_factura = vt.numero_factura_interna
        )
      GROUP BY vt.pedido_proveedor_id
    ),
    pp_base AS (
      SELECT pp.id AS pp_id, COALESCE(pp.pares_comprometidos, 0)::bigint AS total_pares
      FROM compra_legal_pedido clp
      JOIN pedido_proveedor pp ON pp.id = clp.pedido_proveedor_id
      WHERE clp.compra_legal_id = $1
    )
    SELECT
      COALESCE((SELECT SUM(total_pares) FROM pp_base), 0)::int AS total_pares_f9,
      COALESCE((
        SELECT SUM(COALESCE(f.pares_fi, 0) + COALESCE(v.pares_vt, 0))
        FROM pp_base pb
        LEFT JOIN fi_pp f ON f.pp_id = pb.pp_id
        LEFT JOIN vt_pp v ON v.pp_id = pb.pp_id
      ), 0)::int AS pares_facturados
    `,
    [idCl],
  );
  const totalF9 = num(rows[0]?.total_pares_f9);
  const paresFact = num(rows[0]?.pares_facturados);
  return {
    total_pares_f9: totalF9,
    pares_facturados: paresFact,
    pares_deposito: Math.max(totalF9 - paresFact, 0),
  };
}

export async function getCompraHeader(idCl: number): Promise<CompraLegalHeader | null> {
  const pool = getRimecPool();
  const { rows } = await pool.query<{
    id: number;
    numero_registro: string;
    proforma: string;
    fecha_factura: string | null;
    estado: string;
    pps_vinculados: string;
  }>(
    `
    SELECT cl.id, cl.numero_registro, cl.numero_factura_proveedor AS proforma,
           cl.fecha_factura::text AS fecha_factura, cl.estado,
           COALESCE(
             (SELECT STRING_AGG(DISTINCT pp.numero_registro, ' / ' ORDER BY pp.numero_registro)
              FROM compra_legal_pedido clp
              JOIN pedido_proveedor pp ON pp.id = clp.pedido_proveedor_id
              WHERE clp.compra_legal_id = cl.id),
             '—'
           ) AS pps_vinculados
    FROM compra_legal cl WHERE cl.id = $1
    `,
    [idCl],
  );
  if (!rows.length) return null;
  const met = await getMetricasFacturacionCompra(idCl);
  const r = rows[0];
  return {
    id: r.id,
    numero_registro: r.numero_registro,
    proforma: r.proforma || "—",
    fecha_factura: r.fecha_factura,
    estado: r.estado,
    pps_vinculados: r.pps_vinculados,
    ...met,
  };
}

export async function getPpsDeCompra(idCl: number): Promise<PpDeCompra[]> {
  const pool = getRimecPool();
  const { rows } = await pool.query<PpDeCompra>(
    `
    SELECT pp.id, pp.numero_registro, pp.numero_proforma, pp.estado,
      COALESCE(
        (SELECT STRING_AGG(DISTINCT mv.descp_marca, ' / ')
         FROM pedido_proveedor_detalle ppd2
         JOIN marca_v2 mv ON mv.id_marca = ppd2.id_marca
         WHERE ppd2.pedido_proveedor_id = pp.id),
        '—'
      ) AS marcas,
      COALESCE(SUM(ppd.cantidad_pares), 0)::int AS total_pares,
      (
        COALESCE(
          (SELECT SUM(fid.pares) FROM factura_interna fi
           JOIN factura_interna_detalle fid ON fid.factura_id = fi.id
           WHERE fi.pp_id = pp.id AND fi.estado IN ('CONFIRMADA', 'RESERVADA')),
          0
        ) + COALESCE(
          (SELECT SUM(vt.cantidad_vendida) FROM venta_transito vt
           WHERE vt.pedido_proveedor_id = pp.id
             AND NOT EXISTS (
               SELECT 1 FROM factura_interna fi2
               WHERE fi2.pp_id = vt.pedido_proveedor_id AND fi2.nro_factura = vt.numero_factura_interna
             )),
          0
        )
      )::int AS total_vendido
    FROM compra_legal_pedido clp
    JOIN pedido_proveedor pp ON pp.id = clp.pedido_proveedor_id
    LEFT JOIN pedido_proveedor_detalle ppd ON ppd.pedido_proveedor_id = pp.id
    WHERE clp.compra_legal_id = $1
    GROUP BY pp.id, pp.numero_registro, pp.numero_proforma, pp.estado
    ORDER BY pp.numero_registro
    `,
    [idCl],
  );
  return rows.map((r) => ({ ...r, total_pares: num(r.total_pares), total_vendido: num(r.total_vendido) }));
}

export async function getCompraHijaDeposito(idCl: number): Promise<DepositoHijaRow[]> {
  const pool = getRimecPool();
  const { rows } = await pool.query<DepositoHijaRow>(
    `
    SELECT COALESCE(mv.descp_marca, '—') AS marca,
           ppd.linea::text AS linea, ppd.referencia::text AS referencia,
           ppd.descp_material AS material, ppd.descp_color AS color,
           ppd.cantidad_pares::int AS cantidad_inicial,
           COALESCE((SELECT SUM(vt.cantidad_vendida)::int FROM venta_transito vt
                     WHERE vt.pedido_proveedor_detalle_id = ppd.id), 0) AS vendido,
           (ppd.cantidad_pares - COALESCE((SELECT SUM(vt.cantidad_vendida) FROM venta_transito vt
                     WHERE vt.pedido_proveedor_detalle_id = ppd.id), 0))::int AS saldo
    FROM compra_legal_pedido clp
    JOIN pedido_proveedor_detalle ppd ON ppd.pedido_proveedor_id = clp.pedido_proveedor_id
    LEFT JOIN marca_v2 mv ON mv.id_marca = ppd.id_marca
    WHERE clp.compra_legal_id = $1 AND ppd.linea IS NOT NULL
    ORDER BY mv.descp_marca, ppd.linea, ppd.referencia
    `,
    [idCl],
  );
  return rows.map((r) => ({
    ...r,
    cantidad_inicial: num(r.cantidad_inicial),
    vendido: num(r.vendido),
    saldo: num(r.saldo),
  }));
}

export async function getFacturasInternasDeCompra(idCl: number): Promise<FiDeCompraRow[]> {
  const pool = getRimecPool();
  const { rows } = await pool.query<FiDeCompraRow>(
    `
    SELECT fi.id, fi.nro_factura, fi.pv_global, fi.estado, fi.created_at::text AS created_at,
           fi.pp_id, pp.numero_registro AS nro_pp, fi.marca, fi.caso,
           COALESCE(cv.descp_cliente, fi.cliente_id::text) AS cliente,
           COALESCE(vv.descp_usuario, '—') AS vendedor,
           fi.total_pares::int, fi.total_monto::float8 AS total_monto,
           fi.lista_precio_id,
           COALESCE(fi.descuento_1, 0)::float8 AS descuento_1,
           COALESCE(fi.descuento_2, 0)::float8 AS descuento_2,
           COALESCE(fi.descuento_3, 0)::float8 AS descuento_3,
           COALESCE(fi.descuento_4, 0)::float8 AS descuento_4
    FROM factura_interna fi
    JOIN compra_legal_pedido clp ON clp.pedido_proveedor_id = fi.pp_id
    LEFT JOIN pedido_proveedor pp ON pp.id = fi.pp_id
    LEFT JOIN cliente_v2 cv ON cv.id_cliente = fi.cliente_id
    LEFT JOIN usuario_v2 vv ON vv.id_usuario = fi.vendedor_id
    WHERE clp.compra_legal_id = $1 AND fi.estado IN ('CONFIRMADA', 'RESERVADA')
    ORDER BY fi.created_at DESC, fi.nro_factura
    `,
    [idCl],
  );
  return rows.map((r) => ({
    ...r,
    total_pares: num(r.total_pares),
    total_monto: num(r.total_monto),
    descuento_1: num(r.descuento_1),
    descuento_2: num(r.descuento_2),
    descuento_3: num(r.descuento_3),
    descuento_4: num(r.descuento_4),
  }));
}

export async function getCompraDetalleCompleto(idCl: number) {
  const [header, pps, deposito, facturas] = await Promise.all([
    getCompraHeader(idCl),
    getPpsDeCompra(idCl),
    getCompraHijaDeposito(idCl),
    getFacturasInternasDeCompra(idCl),
  ]);
  return { header, pps, deposito, facturas };
}
