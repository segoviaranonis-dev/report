import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import type {
  AprobacionesData,
  FiDetalle,
  FiRecord,
  PedidoPendiente,
} from "./aprobaciones-types";
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
      v.descp_usuario AS vendedor_nombre,
      pvr.plazo_id,
      p.descp_plazo AS plazo_nombre,
      pvr.lista_precio_id,
      pvr.descuento_1, pvr.descuento_2, pvr.descuento_3, pvr.descuento_4,
      pvr.total_pares,
      pvr.total_monto,
      pvr.created_at,
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
           v.descp_usuario AS vendedor_nombre,
           pl.descp_plazo AS plazo_nombre,
           pp.numero_registro AS nro_pp,
           pp.numero_proforma AS proforma,
           pp.estado AS pp_estado,
           qa.descripcion AS quincena_llegada
    FROM factura_interna fi
    LEFT JOIN cliente_v2 c ON c.id_cliente = fi.cliente_id
    LEFT JOIN usuario_v2 v ON v.id_usuario = fi.vendedor_id
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
      v.descp_usuario AS vendedor_nombre,
      pl.descp_plazo AS plazo_nombre,
      pp.numero_registro AS nro_pp,
      pp.numero_proforma AS proforma,
      pp.estado AS pp_estado,
      qa.descripcion AS quincena_llegada,
      fi.created_at,
      fi.fecha_confirmacion
    FROM factura_interna fi
    LEFT JOIN cliente_v2 c ON c.id_cliente = fi.cliente_id
    LEFT JOIN usuario_v2 v ON v.id_usuario = fi.vendedor_id
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
           v.descp_usuario AS vendedor_nombre,
           pl.descp_plazo AS plazo_nombre,
           pp.numero_registro AS nro_pp,
           pp.numero_proforma AS proforma,
           pp.estado AS pp_estado,
           fi.created_at,
           fi.fecha_confirmacion
    FROM factura_interna fi
    LEFT JOIN cliente_v2 c ON c.id_cliente = fi.cliente_id
    LEFT JOIN usuario_v2 v ON v.id_usuario = fi.vendedor_id
    LEFT JOIN plazo_v2 pl ON pl.id_plazo = fi.plazo_id
    LEFT JOIN pedido_proveedor pp ON pp.id = fi.pp_id
    WHERE fi.estado = 'ANULADA'
    ORDER BY COALESCE(fi.fecha_confirmacion, fi.created_at) DESC NULLS LAST
    LIMIT 200
  `);
  return rows.map(mapFiRow);
}

/** get_fis_de_pedido() */
export async function fetchFisDePedido(pedidoId: number): Promise<FiRecord[]> {
  if (!isRimecDatabaseConfigured()) return [];
  const pool = getRimecPool();
  const { rows } = await pool.query(
    `
    SELECT
      fi.id, fi.nro_factura, fi.pv_global,
      fi.pp_id, fi.pedido_id,
      fi.marca, fi.marca_id, fi.caso, fi.caso_id,
      fi.total_pares, fi.total_monto, fi.estado,
      fi.cliente_id, fi.vendedor_id, fi.plazo_id, fi.lista_precio_id,
      fi.descuento_1, fi.descuento_2, fi.descuento_3, fi.descuento_4,
      fi.created_at,
      fi.fecha_confirmacion,
      pp.numero_registro AS nro_pp,
      pp.numero_proforma AS proforma,
      pp.estado AS pp_estado,
      c.descp_cliente AS cliente_nombre,
      v.descp_usuario AS vendedor_nombre,
      pl.descp_plazo AS plazo_nombre,
      qa.descripcion AS quincena_llegada
    FROM public.factura_interna fi
    LEFT JOIN public.pedido_proveedor pp ON pp.id = fi.pp_id
    LEFT JOIN cliente_v2 c ON c.id_cliente = fi.cliente_id
    LEFT JOIN usuario_v2 v ON v.id_usuario = fi.vendedor_id
    LEFT JOIN plazo_v2 pl ON pl.id_plazo = fi.plazo_id
    LEFT JOIN quincena_arribo qa ON qa.id = pp.quincena_arribo_id
    WHERE
      UPPER(TRIM(fi.estado)) = 'RESERVADA'
      AND (
        fi.pedido_id = $1
        OR (
          fi.pedido_id IS NULL
          AND ABS(EXTRACT(EPOCH FROM (
            fi.created_at - (SELECT created_at FROM public.pedido_venta_rimec WHERE id = $1)
          ))) < 10
        )
      )
    ORDER BY fi.pp_id, fi.marca, fi.caso
  `,
    [pedidoId]
  );
  return rows.map(mapFiRow);
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

/** Carga los 4 datasets + items batch — SSR inicial */
export async function fetchAprobacionesData(): Promise<AprobacionesData> {
  const [pendientes, reservadas, confirmadas, anuladas] = await Promise.all([
    fetchPedidosPendientes(),
    fetchFiReservadas(),
    fetchFiConfirmadas(),
    fetchFiAnuladas(),
  ]);
  const allFiIds = [...reservadas, ...confirmadas, ...anuladas].map((f) => f.id);
  const detallesPorFi = await fetchFiDetallesBatch(allFiIds);
  return { pendientes, reservadas, confirmadas, anuladas, detallesPorFi };
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
