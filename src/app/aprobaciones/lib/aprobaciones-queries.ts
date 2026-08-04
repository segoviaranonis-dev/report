import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import {
  SQL_VENDEDOR_FI_DISPLAY,
  SQL_VENDEDOR_FI_JOINS,
} from "@/lib/facturacion/vendedor-fi-display";
import type {
  AprobacionesData,
  FiDetalle,
  FiRecord,
  PedidoPendiente,
} from "./aprobaciones-types";
import type { AprobacionesFiltros, AprobacionesFiltrosOpciones } from "./aprobaciones-filtros-types";
import { filtrosActivos } from "./aprobaciones-filtros-types";
import { buildFiFiltrosSql, buildPedidoFiltrosSql } from "./aprobaciones-filtros-query";
import { parseLineaSnapshotForDisplay, gradasDisplayFromSnapshot } from "./linea-snapshot-display";
import { enrichLineaSnapshotFromPpd } from "@/lib/pedido-proveedor/linea-snapshot-fi";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function inferOrigenPeFi(r: Record<string, unknown>): boolean {
  const ppId = r.pp_id;
  const nro = String(r.nro_factura ?? "");
  if (ppId == null) return true;
  if (nro.startsWith("PE-")) return true;
  return false;
}

function mapFiRow(r: Record<string, unknown>): FiRecord {
  return {
    id: num(r.id),
    nro_factura: String(r.nro_factura ?? ""),
    pv_global: r.pv_global != null ? num(r.pv_global) : null,
    pp_id: r.pp_id != null ? num(r.pp_id) : null,
    pedido_id: r.pedido_id != null ? num(r.pedido_id) : null,
    marca: String(r.marca ?? "Sin marca"),
    caso: String(r.caso ?? "Sin caso"),
    estado: String(r.estado ?? ""),
    total_pares: num(r.total_pares),
    total_monto: num(r.total_monto),
    cliente_id: r.cliente_id != null ? num(r.cliente_id) : null,
    vendedor_id: r.vendedor_id != null ? num(r.vendedor_id) : null,
    plazo_id: r.plazo_id != null ? num(r.plazo_id) : null,
    plazo_nombre: r.plazo_nombre != null ? String(r.plazo_nombre) : null,
    lista_precio_id: r.lista_precio_id != null ? num(r.lista_precio_id) : null,
    descuento_1: num(r.descuento_1),
    descuento_2: num(r.descuento_2),
    descuento_3: num(r.descuento_3),
    descuento_4: num(r.descuento_4),
    cliente_nombre: r.cliente_nombre != null ? String(r.cliente_nombre) : null,
    vendedor_nombre: r.vendedor_nombre != null ? String(r.vendedor_nombre) : null,
    nro_pp: r.nro_pp != null ? String(r.nro_pp) : null,
    proforma: r.proforma != null ? String(r.proforma) : null,
    quincena_llegada: r.quincena_llegada != null ? String(r.quincena_llegada) : null,
    pp_estado: r.pp_estado != null ? String(r.pp_estado) : null,
    notas: r.notas != null ? String(r.notas) : null,
    observacion: r.observacion != null ? String(r.observacion) : null,
    fecha_entrega_cliente:
      r.fecha_entrega_cliente != null ? String(r.fecha_entrega_cliente).slice(0, 10) : null,
    origen_pe: inferOrigenPeFi(r),
    created_at: r.created_at != null ? String(r.created_at) : null,
    fecha_confirmacion:
      r.fecha_confirmacion != null ? String(r.fecha_confirmacion) : null,
  };
}

/** get_pedidos_pendientes() — logic.py */
export async function fetchPedidosPendientes(): Promise<PedidoPendiente[]> {
  if (!isRimecDatabaseConfigured()) return [];
  const pool = getRimecPool();
  const { rows } = await pool.query(`
    SELECT
      pvr.id,
      pvr.nro_pedido,
      pvr.cliente_id,
      c.descp_cliente AS cliente_nombre,
      pvr.vendedor_id,
      COALESCE(
        NULLIF(TRIM(pvr.payload_json->>'vendedor_nombre'), ''),
        NULLIF(TRIM(v.descp_usuario), ''),
        '—'
      ) AS vendedor_nombre,
      pvr.plazo_id,
      p.descp_plazo AS plazo_nombre,
      pvr.lista_precio_id,
      pvr.descuento_1, pvr.descuento_2, pvr.descuento_3, pvr.descuento_4,
      pvr.total_pares,
      pvr.total_monto,
      pvr.created_at,
      COALESCE(
        NULLIF(TRIM(pvr.observacion), ''),
        NULLIF(TRIM(pvr.payload_json->>'observacion'), '')
      ) AS observacion,
      COALESCE(
        pvr.fecha_entrega_cliente::text,
        NULLIF(TRIM(pvr.payload_json->>'fecha_entrega_cliente'), '')
      ) AS fecha_entrega_cliente,
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(pvr.payload_json->'lotes', '[]'::jsonb)) l
        WHERE COALESCE((l->>'origen_pe')::boolean, false)
           OR NULLIF(l->>'pp_id', '')::bigint < 0
      ) AS origen_pe,
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(pvr.payload_json->'lotes', '[]'::jsonb)) l
        WHERE NOT COALESCE((l->>'origen_pe')::boolean, false)
          AND COALESCE(NULLIF(l->>'pp_id', '')::bigint, 0) > 0
      ) AS tiene_compra_previa
    FROM pedido_venta_rimec pvr
    JOIN cliente_v2 c ON c.id_cliente = pvr.cliente_id
    LEFT JOIN usuario_v2 v ON v.id_usuario = pvr.vendedor_id
    LEFT JOIN plazo_v2 p ON p.id_plazo = pvr.plazo_id
    WHERE pvr.estado = 'PENDIENTE'
      AND EXISTS (
        SELECT 1 FROM factura_interna fi
        WHERE fi.pedido_id = pvr.id AND fi.estado = 'RESERVADA'
      )
    ORDER BY pvr.created_at DESC
  `);
  return rows.map((r) => ({
    id: num(r.id),
    nro_pedido: String(r.nro_pedido ?? ""),
    cliente_id: num(r.cliente_id),
    cliente_nombre: String(r.cliente_nombre ?? ""),
    vendedor_id: r.vendedor_id != null ? num(r.vendedor_id) : null,
    vendedor_nombre: r.vendedor_nombre != null ? String(r.vendedor_nombre) : null,
    plazo_id: r.plazo_id != null ? num(r.plazo_id) : null,
    plazo_nombre: r.plazo_nombre != null ? String(r.plazo_nombre) : null,
    lista_precio_id: r.lista_precio_id != null ? num(r.lista_precio_id) : null,
    descuento_1: num(r.descuento_1),
    descuento_2: num(r.descuento_2),
    descuento_3: num(r.descuento_3),
    descuento_4: num(r.descuento_4),
    total_pares: num(r.total_pares),
    total_monto: num(r.total_monto),
    created_at: r.created_at != null ? String(r.created_at) : null,
    origen_pe: Boolean(r.origen_pe),
    tiene_compra_previa: Boolean(r.tiene_compra_previa),
    observacion: r.observacion != null ? String(r.observacion) : null,
    fecha_entrega_cliente:
      r.fecha_entrega_cliente != null ? String(r.fecha_entrega_cliente).slice(0, 10) : null,
  }));
}

/** get_fi_reservadas() */
export async function fetchFiReservadas(): Promise<FiRecord[]> {
  if (!isRimecDatabaseConfigured()) return [];
  const pool = getRimecPool();
  const { rows } = await pool.query(`
    SELECT fi.id, fi.nro_factura, fi.pv_global, fi.pp_id, fi.pedido_id, fi.marca, fi.caso,
           fi.estado, fi.total_pares, fi.total_monto,
           fi.cliente_id, fi.vendedor_id, fi.plazo_id, fi.lista_precio_id,
           fi.descuento_1, fi.descuento_2, fi.descuento_3, fi.descuento_4,
           fi.created_at, fi.fecha_confirmacion,
           c.descp_cliente AS cliente_nombre,
           ${SQL_VENDEDOR_FI_DISPLAY} AS vendedor_nombre,
           pl.descp_plazo AS plazo_nombre,
           pp.numero_registro AS nro_pp,
           pp.numero_proforma AS proforma,
           pp.estado AS pp_estado,
           qa.descripcion AS quincena_llegada
    FROM factura_interna fi
    LEFT JOIN cliente_v2 c ON c.id_cliente = fi.cliente_id
    ${SQL_VENDEDOR_FI_JOINS}
    LEFT JOIN plazo_v2 pl ON pl.id_plazo = fi.plazo_id
    LEFT JOIN pedido_proveedor pp ON pp.id = fi.pp_id
    LEFT JOIN quincena_arribo qa ON qa.id = pp.quincena_arribo_id
    WHERE fi.estado = 'RESERVADA'
    ORDER BY fi.fecha_confirmacion DESC NULLS LAST, fi.created_at DESC
  `);
  return rows.map(mapFiRow);
}

/** get_fi_confirmadas() — ORDER BY pv_global DESC */
export async function fetchFiConfirmadas(): Promise<FiRecord[]> {
  if (!isRimecDatabaseConfigured()) return [];
  const pool = getRimecPool();
  const { rows } = await pool.query(`
    SELECT
      fi.id, fi.nro_factura, fi.pp_id, fi.pedido_id, fi.marca, fi.caso,
      fi.estado, fi.total_pares, fi.total_monto,
      fi.cliente_id, fi.vendedor_id, fi.plazo_id, fi.lista_precio_id,
      fi.descuento_1, fi.descuento_2, fi.descuento_3, fi.descuento_4,
      fi.pv_global,
      c.descp_cliente AS cliente_nombre,
      ${SQL_VENDEDOR_FI_DISPLAY} AS vendedor_nombre,
      pl.descp_plazo AS plazo_nombre,
      pp.numero_registro AS nro_pp,
      pp.numero_proforma AS proforma,
      pp.estado AS pp_estado,
      qa.descripcion AS quincena_llegada,
      fi.created_at,
      fi.fecha_confirmacion
    FROM factura_interna fi
    LEFT JOIN cliente_v2 c ON c.id_cliente = fi.cliente_id
    ${SQL_VENDEDOR_FI_JOINS}
    LEFT JOIN plazo_v2 pl ON pl.id_plazo = fi.plazo_id
    LEFT JOIN pedido_proveedor pp ON pp.id = fi.pp_id
    LEFT JOIN quincena_arribo qa ON qa.id = pp.quincena_arribo_id
    WHERE fi.estado = 'CONFIRMADA'
    ORDER BY fi.fecha_confirmacion DESC NULLS LAST, fi.pv_global DESC
    LIMIT 200
  `);
  return rows.map(mapFiRow);
}

/** get_fi_anuladas() */
export async function fetchFiAnuladas(): Promise<FiRecord[]> {
  if (!isRimecDatabaseConfigured()) return [];
  const pool = getRimecPool();
  const { rows } = await pool.query(`
    SELECT fi.id, fi.nro_factura, fi.pv_global, fi.pp_id, fi.marca, fi.caso,
           fi.estado, fi.total_pares, fi.total_monto, fi.notas,
           fi.cliente_id, fi.vendedor_id, fi.plazo_id, fi.lista_precio_id,
           fi.descuento_1, fi.descuento_2, fi.descuento_3, fi.descuento_4,
           c.descp_cliente AS cliente_nombre,
           ${SQL_VENDEDOR_FI_DISPLAY} AS vendedor_nombre,
           pl.descp_plazo AS plazo_nombre,
           pp.numero_registro AS nro_pp,
           pp.numero_proforma AS proforma,
           pp.estado AS pp_estado,
           fi.created_at,
           fi.fecha_confirmacion
    FROM factura_interna fi
    LEFT JOIN cliente_v2 c ON c.id_cliente = fi.cliente_id
    ${SQL_VENDEDOR_FI_JOINS}
    LEFT JOIN plazo_v2 pl ON pl.id_plazo = fi.plazo_id
    LEFT JOIN pedido_proveedor pp ON pp.id = fi.pp_id
    WHERE fi.estado = 'ANULADA'
    ORDER BY COALESCE(fi.fecha_confirmacion, fi.created_at) DESC NULLS LAST
    LIMIT 200
  `);
  return rows.map(mapFiRow);
}

const FI_DE_PEDIDO_SELECT = `
    SELECT
      fi.id, fi.nro_factura, fi.pv_global,
      fi.pp_id, fi.pedido_id,
      fi.marca, fi.marca_id, fi.caso, fi.caso_id,
      fi.total_pares, fi.total_monto, fi.estado,
      fi.cliente_id, fi.vendedor_id, fi.plazo_id, fi.lista_precio_id,
      fi.descuento_1, fi.descuento_2, fi.descuento_3, fi.descuento_4,
      fi.created_at,
      fi.fecha_confirmacion,
      fi.observacion,
      fi.fecha_entrega_cliente::text AS fecha_entrega_cliente,
      pp.numero_registro AS nro_pp,
      pp.numero_proforma AS proforma,
      pp.estado AS pp_estado,
      c.descp_cliente AS cliente_nombre,
      ${SQL_VENDEDOR_FI_DISPLAY} AS vendedor_nombre,
      pl.descp_plazo AS plazo_nombre,
      qa.descripcion AS quincena_llegada
    FROM public.factura_interna fi
    LEFT JOIN public.pedido_proveedor pp ON pp.id = fi.pp_id
    LEFT JOIN cliente_v2 c ON c.id_cliente = fi.cliente_id
    ${SQL_VENDEDOR_FI_JOINS}
    LEFT JOIN plazo_v2 pl ON pl.id_plazo = fi.plazo_id
    LEFT JOIN quincena_arribo qa ON qa.id = pp.quincena_arribo_id
`;

/** get_fis_de_pedido() — path rápido por pedido_id (índice); fallback huérfanas sin scan global. */
export async function fetchFisDePedido(pedidoId: number): Promise<FiRecord[]> {
  if (!isRimecDatabaseConfigured()) return [];
  const pool = getRimecPool();

  const primary = await pool.query(
    `
    ${FI_DE_PEDIDO_SELECT}
    WHERE fi.pedido_id = $1
      AND UPPER(TRIM(fi.estado)) = 'RESERVADA'
    ORDER BY fi.pp_id NULLS LAST, fi.marca, fi.caso
    `,
    [pedidoId],
  );
  if (primary.rows.length > 0) return primary.rows.map(mapFiRow);

  // Fallback legacy: FI sin pedido_id creadas en la misma ventana (±30s) del PVR
  const fallback = await pool.query(
    `
    ${FI_DE_PEDIDO_SELECT}
    WHERE fi.pedido_id IS NULL
      AND UPPER(TRIM(fi.estado)) = 'RESERVADA'
      AND fi.created_at BETWEEN
        (SELECT created_at - INTERVAL '30 seconds' FROM public.pedido_venta_rimec WHERE id = $1)
        AND (SELECT created_at + INTERVAL '30 seconds' FROM public.pedido_venta_rimec WHERE id = $1)
    ORDER BY fi.pp_id NULLS LAST, fi.marca, fi.caso
    `,
    [pedidoId],
  );
  return fallback.rows.map(mapFiRow);
}

function mapDetalleRow(r: Record<string, unknown>): FiDetalle {
  const snapRaw = enrichLineaSnapshotFromPpd(r.linea_snapshot, {
    linea: r.ppd_linea != null ? String(r.ppd_linea) : null,
    referencia: r.ppd_referencia != null ? String(r.ppd_referencia) : null,
    material_code: r.ppd_material_code != null ? String(r.ppd_material_code) : null,
    color_code: r.ppd_color_code != null ? String(r.ppd_color_code) : null,
    grades_json: r.grades_json,
  });
  const snap = parseLineaSnapshotForDisplay(snapRaw);
  let gradas_display = snap.gradas_display;
  if (!gradas_display.trim()) {
    gradas_display =
      gradasDisplayFromSnapshot({ grades_json: r.grades_json }) ||
      gradasDisplayFromSnapshot({ gradas: r.gradas, grades_json: r.gradas });
  }
  return {
    id: num(r.id),
    pares: num(r.pares),
    cajas: num(r.cajas),
    precio_unit: num(r.precio_unit),
    precio_neto: num(r.precio_neto),
    subtotal: num(r.subtotal),
    linea_codigo: snap.linea_codigo,
    ref_codigo: snap.ref_codigo,
    color_nombre: snap.color_nombre,
    material_nombre: snap.material_nombre,
    gradas_display,
    imageCandidates: snap.imageCandidates.filter(Boolean),
    imageSearchName: snap.imageSearchName,
    sin_lpn: snap.sin_lpn,
  };
}

const FI_DETALLE_SELECT = `
  SELECT
    fid.id,
    fid.factura_id,
    fid.pares,
    fid.cajas,
    fid.precio_unit,
    fid.precio_neto,
    fid.subtotal,
    fid.linea_snapshot,
    ppd.linea AS ppd_linea,
    ppd.referencia AS ppd_referencia,
    ppd.material_code AS ppd_material_code,
    ppd.color_code AS ppd_color_code,
    ppd.grades_json
  FROM public.factura_interna_detalle fid
  LEFT JOIN public.pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
`;

/** Batch — un query para todas las FIs visibles (evita 145 fetches en Confirmadas) */
export async function fetchFiDetallesBatch(
  fiIds: number[],
): Promise<Record<number, FiDetalle[]>> {
  if (!isRimecDatabaseConfigured() || fiIds.length === 0) return {};
  const pool = getRimecPool();
  const { rows } = await pool.query(
    `
    ${FI_DETALLE_SELECT}
    WHERE fid.factura_id = ANY($1::int[])
    ORDER BY fid.factura_id, fid.id
  `,
    [fiIds],
  );
  const map: Record<number, FiDetalle[]> = {};
  for (const id of fiIds) map[id] = [];
  for (const r of rows) {
    const fiId = num(r.factura_id);
    map[fiId].push(mapDetalleRow(r));
  }
  return map;
}

/** get_fi_detalles_lite() */
export async function fetchFiDetallesLite(fiId: number): Promise<FiDetalle[]> {
  if (!isRimecDatabaseConfigured()) return [];
  const pool = getRimecPool();
  const { rows } = await pool.query(
    `
    ${FI_DETALLE_SELECT}
    WHERE fid.factura_id = $1
    ORDER BY fid.id
  `,
    [fiId],
  );
  return rows.map(mapDetalleRow);
}

/** Contadores ligeros — sin traer 500+ FIs ni detalles al SSR. */
async function countFiEstado(estado: string): Promise<number> {
  if (!isRimecDatabaseConfigured()) return 0;
  const pool = getRimecPool();
  const { rows } = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM factura_interna WHERE UPPER(TRIM(estado)) = $1`,
    [estado],
  );
  return parseInt(rows[0]?.n ?? "0", 10) || 0;
}

/**
 * SSR liviano — Director: Pendiente / Aprobado / Anulado.
 * Prohibido: batch de detalles de 500+ FIs (era el hang de “Cargando facturas…”).
 */
export async function fetchAprobacionesData(): Promise<AprobacionesData> {
  const t0 = Date.now();
  const [pendientes, countAprobados, countAnulados] = await Promise.all([
    fetchPedidosPendientes(),
    countFiEstado("CONFIRMADA"),
    countFiEstado("ANULADA"),
  ]);

  // FIs por pedido: lazy en cliente al expandir (evita N×query en SSR).
  const fisPorPedido: Record<number, FiRecord[]> = {};

  console.log(
    `[aprobaciones] SSR liviano ${Date.now() - t0}ms · pendientes=${pendientes.length} · aprobados=${countAprobados}`,
  );

  return {
    pendientes,
    fisPorPedido,
    countAprobados,
    countAnulados,
    confirmadas: [],
    anuladas: [],
    detallesPorFi: {},
  };
}

/** Catálogos para editores Nivel Dios */
export async function fetchAprobacionesCatalogos(): Promise<import("./aprobaciones-types").AprobacionesCatalogos> {
  if (!isRimecDatabaseConfigured()) return { plazos: [], vendedores: [] };
  const pool = getRimecPool();
  const [plazosRes, vendRes] = await Promise.all([
    pool.query<{ id_plazo: number; nombre: string }>(
      `SELECT id_plazo, TRIM(descp_plazo) AS nombre FROM plazo_v2 ORDER BY id_plazo`,
    ),
    pool.query<{ id_usuario: number; nombre: string }>(
      `SELECT id_usuario, TRIM(descp_usuario) AS nombre FROM usuario_v2 ORDER BY descp_usuario`,
    ),
  ]);
  return {
    plazos: plazosRes.rows.map((r) => ({ id: num(r.id_plazo), nombre: String(r.nombre || `#${r.id_plazo}`) })),
    vendedores: vendRes.rows.map((r) => ({
      id: num(r.id_usuario),
      nombre: String(r.nombre || `#${r.id_usuario}`),
    })),
  };
}

const FI_LIST_SELECT = `
    SELECT
      fi.id, fi.nro_factura, fi.pp_id, fi.pedido_id, fi.marca, fi.caso,
      fi.estado, fi.total_pares, fi.total_monto,
      fi.cliente_id, fi.vendedor_id, fi.plazo_id, fi.lista_precio_id,
      fi.descuento_1, fi.descuento_2, fi.descuento_3, fi.descuento_4,
      fi.pv_global,
      c.descp_cliente AS cliente_nombre,
      ${SQL_VENDEDOR_FI_DISPLAY} AS vendedor_nombre,
      pl.descp_plazo AS plazo_nombre,
      pp.numero_registro AS nro_pp,
      pp.numero_proforma AS proforma,
      pp.estado AS pp_estado,
      qa.descripcion AS quincena_llegada,
      fi.created_at,
      fi.fecha_confirmacion,
      fi.notas,
      fi.observacion,
      fi.fecha_entrega_cliente::text AS fecha_entrega_cliente
    FROM factura_interna fi
    LEFT JOIN cliente_v2 c ON c.id_cliente = fi.cliente_id
    ${SQL_VENDEDOR_FI_JOINS}
    LEFT JOIN plazo_v2 pl ON pl.id_plazo = fi.plazo_id
    LEFT JOIN pedido_proveedor pp ON pp.id = fi.pp_id
    LEFT JOIN quincena_arribo qa ON qa.id = pp.quincena_arribo_id
`;

export async function fetchFiConfirmadasConFiltros(
  filtros: AprobacionesFiltros,
  limit = 200,
): Promise<FiRecord[]> {
  if (!isRimecDatabaseConfigured()) return [];
  const pool = getRimecPool();
  const { sql: fSql, params: fParams } = buildFiFiltrosSql(filtros, {
    fechaExpr: "COALESCE(fi.fecha_confirmacion, fi.created_at)",
  });
  const { rows } = await pool.query(
    `
    ${FI_LIST_SELECT}
    WHERE fi.estado = 'CONFIRMADA'
    ${fSql}
    ORDER BY fi.fecha_confirmacion DESC NULLS LAST, fi.pv_global DESC
    LIMIT $${fParams.length + 1}
    `,
    [...fParams, limit],
  );
  return rows.map(mapFiRow);
}

export async function fetchFiAnuladasConFiltros(
  filtros: AprobacionesFiltros,
  limit = 200,
): Promise<FiRecord[]> {
  if (!isRimecDatabaseConfigured()) return [];
  const pool = getRimecPool();
  const { sql: fSql, params: fParams } = buildFiFiltrosSql(filtros, {
    fechaExpr: "COALESCE(fi.fecha_confirmacion, fi.created_at)",
  });
  const { rows } = await pool.query(
    `
    ${FI_LIST_SELECT}
    WHERE fi.estado = 'ANULADA'
    ${fSql}
    ORDER BY COALESCE(fi.fecha_confirmacion, fi.created_at) DESC NULLS LAST
    LIMIT $${fParams.length + 1}
    `,
    [...fParams, limit],
  );
  return rows.map(mapFiRow);
}

export async function countFiConFiltros(
  estado: "CONFIRMADA" | "ANULADA" | "RESERVADA",
  filtros: AprobacionesFiltros,
): Promise<number> {
  if (!isRimecDatabaseConfigured()) return 0;
  if (!filtrosActivos(filtros)) return countFiEstado(estado);
  const pool = getRimecPool();
  const { sql: fSql, params: fParams } = buildFiFiltrosSql(filtros, {
    fechaExpr: "COALESCE(fi.fecha_confirmacion, fi.created_at)",
  });
  const { rows } = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM factura_interna fi WHERE UPPER(TRIM(fi.estado)) = $1 ${fSql}`,
    [estado, ...fParams],
  );
  return parseInt(rows[0]?.n ?? "0", 10) || 0;
}

/** Pedidos pendientes con filtros de indagación. */
export async function fetchPedidosPendientesConFiltros(
  filtros: AprobacionesFiltros,
): Promise<PedidoPendiente[]> {
  if (!isRimecDatabaseConfigured()) return [];
  if (!filtrosActivos(filtros)) return fetchPedidosPendientes();

  const pool = getRimecPool();
  const { sql: fSql, params: fParams } = buildPedidoFiltrosSql(filtros);
  const { rows } = await pool.query(
    `
    SELECT
      pvr.id,
      pvr.nro_pedido,
      pvr.cliente_id,
      c.descp_cliente AS cliente_nombre,
      pvr.vendedor_id,
      COALESCE(
        NULLIF(TRIM(pvr.payload_json->>'vendedor_nombre'), ''),
        NULLIF(TRIM(v.descp_usuario), ''),
        '—'
      ) AS vendedor_nombre,
      pvr.plazo_id,
      p.descp_plazo AS plazo_nombre,
      pvr.lista_precio_id,
      pvr.descuento_1, pvr.descuento_2, pvr.descuento_3, pvr.descuento_4,
      pvr.total_pares,
      pvr.total_monto,
      pvr.created_at,
      COALESCE(
        NULLIF(TRIM(pvr.observacion), ''),
        NULLIF(TRIM(pvr.payload_json->>'observacion'), '')
      ) AS observacion,
      COALESCE(
        pvr.fecha_entrega_cliente::text,
        NULLIF(TRIM(pvr.payload_json->>'fecha_entrega_cliente'), '')
      ) AS fecha_entrega_cliente,
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(pvr.payload_json->'lotes', '[]'::jsonb)) l
        WHERE COALESCE((l->>'origen_pe')::boolean, false)
           OR NULLIF(l->>'pp_id', '')::bigint < 0
      ) AS origen_pe,
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(pvr.payload_json->'lotes', '[]'::jsonb)) l
        WHERE NOT COALESCE((l->>'origen_pe')::boolean, false)
          AND COALESCE(NULLIF(l->>'pp_id', '')::bigint, 0) > 0
      ) AS tiene_compra_previa
    FROM pedido_venta_rimec pvr
    JOIN cliente_v2 c ON c.id_cliente = pvr.cliente_id
    LEFT JOIN usuario_v2 v ON v.id_usuario = pvr.vendedor_id
    LEFT JOIN plazo_v2 p ON p.id_plazo = pvr.plazo_id
    WHERE pvr.estado = 'PENDIENTE'
      AND EXISTS (
        SELECT 1 FROM factura_interna fi
        WHERE fi.pedido_id = pvr.id AND fi.estado = 'RESERVADA'
      )
    ${fSql}
    ORDER BY pvr.created_at DESC
    `,
    fParams,
  );
  return rows.map((r) => ({
    id: num(r.id),
    nro_pedido: String(r.nro_pedido ?? ""),
    cliente_id: num(r.cliente_id),
    cliente_nombre: String(r.cliente_nombre ?? ""),
    vendedor_id: r.vendedor_id != null ? num(r.vendedor_id) : null,
    vendedor_nombre: r.vendedor_nombre != null ? String(r.vendedor_nombre) : null,
    plazo_id: r.plazo_id != null ? num(r.plazo_id) : null,
    plazo_nombre: r.plazo_nombre != null ? String(r.plazo_nombre) : null,
    lista_precio_id: r.lista_precio_id != null ? num(r.lista_precio_id) : null,
    descuento_1: num(r.descuento_1),
    descuento_2: num(r.descuento_2),
    descuento_3: num(r.descuento_3),
    descuento_4: num(r.descuento_4),
    total_pares: num(r.total_pares),
    total_monto: num(r.total_monto),
    created_at: r.created_at != null ? String(r.created_at) : null,
    origen_pe: Boolean(r.origen_pe),
    tiene_compra_previa: Boolean(r.tiene_compra_previa),
    observacion: r.observacion != null ? String(r.observacion) : null,
    fecha_entrega_cliente:
      r.fecha_entrega_cliente != null ? String(r.fecha_entrega_cliente).slice(0, 10) : null,
  }));
}

/** Ventana de FIs para opciones — evita full scan de detalle (timeout 150s). */
const FI_OPCIONES_CTE = `
  WITH fi_recientes AS (
    SELECT fi.id
    FROM factura_interna fi
    WHERE fi.estado IN ('RESERVADA', 'CONFIRMADA', 'ANULADA')
    ORDER BY COALESCE(fi.fecha_confirmacion, fi.created_at) DESC NULLS LAST
    LIMIT 600
  )
`;

/** Opciones multi-select desde FIs recientes (paridad CSV). */
export async function fetchAprobacionesFiltrosOpciones(
  scope: "basico" | "completo" = "basico",
): Promise<AprobacionesFiltrosOpciones> {
  if (!isRimecDatabaseConfigured()) {
    return { clientes: [], marcas: [], vendedores: [], codigosArticulo: [], codigosGrupoDpe: [] };
  }
  const pool = getRimecPool();
  const t0 = Date.now();

  const [clientesRes, marcasRes, vendRes] = await Promise.all([
    pool.query<{ id: number; nombre: string }>(`
      ${FI_OPCIONES_CTE}
      SELECT DISTINCT c.id_cliente AS id, TRIM(c.descp_cliente) AS nombre
      FROM fi_recientes fr
      JOIN factura_interna fi ON fi.id = fr.id
      JOIN cliente_v2 c ON c.id_cliente = fi.cliente_id
      ORDER BY nombre
      LIMIT 300
    `),
    pool.query<{ marca: string }>(`
      ${FI_OPCIONES_CTE}
      SELECT DISTINCT TRIM(fi.marca) AS marca
      FROM fi_recientes fr
      JOIN factura_interna fi ON fi.id = fr.id
      WHERE TRIM(fi.marca) <> ''
      ORDER BY 1
      LIMIT 80
    `),
    pool.query<{ nombre: string }>(`
      ${FI_OPCIONES_CTE}
      SELECT DISTINCT TRIM(COALESCE(
        NULLIF(TRIM(pvr.payload_json->>'vendedor_nombre'), ''),
        NULLIF(TRIM(u.descp_usuario), ''),
        NULLIF(TRIM(vd.descp_vendedor), ''),
        '—'
      )) AS nombre
      FROM fi_recientes fr
      JOIN factura_interna fi ON fi.id = fr.id
      LEFT JOIN pedido_venta_rimec pvr ON pvr.id = fi.pedido_id
      LEFT JOIN usuario_v2 u ON u.id_usuario = fi.vendedor_id
      LEFT JOIN vendedor_v2 vd ON vd.id_vendedor = fi.vendedor_id
      ORDER BY 1
      LIMIT 60
    `),
  ]);

  let codigosArticulo: string[] = [];
  let codigosGrupoDpe: { id: string; label: string }[] = [];

  if (scope === "completo") {
    const [artRes, grupoRes] = await Promise.all([
      pool.query<{ codigo: string }>(`
        ${FI_OPCIONES_CTE}
        SELECT DISTINCT (ppd.linea || '.' || ppd.referencia) AS codigo
        FROM fi_recientes fr
        JOIN factura_interna_detalle fid ON fid.factura_id = fr.id
        JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
        WHERE ppd.linea IS NOT NULL AND ppd.referencia IS NOT NULL
        ORDER BY 1
        LIMIT 250
      `),
      pool.query<{ id: string; label: string }>(`
        ${FI_OPCIONES_CTE}
        SELECT DISTINCT
          lr.grupo_estilo_id::text AS id,
          COALESCE(NULLIF(TRIM(ge.descp_grupo_estilo), ''), lr.grupo_estilo_id::text) AS label
        FROM fi_recientes fr
        JOIN factura_interna fi ON fi.id = fr.id
        JOIN factura_interna_detalle fid ON fid.factura_id = fr.id
        JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
        LEFT JOIN pedido_proveedor pp ON pp.id = fi.pp_id
        LEFT JOIN linea l ON l.codigo_proveedor::text = ppd.linea
          AND l.proveedor_id = COALESCE(pp.proveedor_importacion_id, 654)
        LEFT JOIN referencia ref ON ref.codigo_proveedor::text = ppd.referencia AND ref.linea_id = l.id
        LEFT JOIN linea_referencia lr ON lr.linea_id = l.id AND lr.referencia_id = ref.id
        LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = lr.grupo_estilo_id
        WHERE lr.grupo_estilo_id IS NOT NULL
        ORDER BY 2
        LIMIT 120
      `),
    ]);
    codigosArticulo = artRes.rows.map((r) => String(r.codigo)).filter(Boolean);
    codigosGrupoDpe = grupoRes.rows.map((r) => ({
      id: String(r.id),
      label: String(r.label),
    }));
  }

  console.log(
    `[aprobaciones] filtros opciones ${scope} ${Date.now() - t0}ms · clientes=${clientesRes.rows.length}`,
  );

  return {
    clientes: clientesRes.rows.map((r) => ({
      id: num(r.id),
      nombre: String(r.nombre ?? ""),
    })),
    marcas: marcasRes.rows.map((r) => String(r.marca)).filter(Boolean),
    vendedores: vendRes.rows.map((r) => String(r.nombre)).filter(Boolean),
    codigosArticulo,
    codigosGrupoDpe,
  };
}
