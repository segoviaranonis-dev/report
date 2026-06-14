/**
 * Compra Web — capa de lectura (gemelo compra_legal/logic.py + facturacion + pedido_proveedor)
 */
import { getRimecPool } from "@/lib/rimec/pool";
import { ALM_WEB_BAZAR, bindClienteWebParams } from "./constants";
import type {
  FacturaLineaLegacy,
  FiDetalleCanonico,
  FiRegistroRow,
  TraspasoDetail,
  TraspasoDetalleLine,
  TraspasoListItem,
} from "./types";

function parseSnapshot(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      try {
        return JSON.parse(raw.replace(/'/g, '"')) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
  }
  return {};
}

function expandSnapshotLines(
  snapshot: Record<string, unknown>,
  casoNombre: string,
): TraspasoDetalleLine[] {
  const items = snapshot.items;
  if (!Array.isArray(items)) return [];

  const rows: TraspasoDetalleLine[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const linea = String(rec.linea ?? "");
    const referencia = String(rec.referencia ?? "");
    const material = String(rec.material ?? "");
    const color = String(rec.color ?? "");
    const tallas = rec.tallas;
    if (!tallas || typeof tallas !== "object") continue;

    for (const [tallaKey, qtyVal] of Object.entries(tallas as Record<string, unknown>)) {
      const qty = Number(qtyVal) || 0;
      if (qty <= 0) continue;
      const tallaNum = tallaKey.replace(/^t/i, "");
      rows.push({
        id: null,
        combinacion_id: null,
        linea,
        referencia,
        material,
        color,
        talla: tallaNum,
        cantidad: qty,
        caso_nombre: casoNombre || "—",
      });
    }
  }
  return rows;
}

/** get_traspasos — ALM_WEB_01 + solo cliente web 5000 */
export async function getTraspasos(estado: string | null): Promise<TraspasoListItem[]> {
  const pool = getRimecPool();
  const baseParams: unknown[] = [ALM_WEB_BAZAR];
  let where = "WHERE t.almacen_destino_id = $1";

  if (estado) {
    baseParams.push(estado);
    where += ` AND t.estado = $${baseParams.length}`;
  }

  const { sql: clienteSql, params } = bindClienteWebParams(baseParams);
  where += clienteSql;

  const { rows } = await pool.query<{
    id: number;
    numero_registro: string;
    fecha_traspaso: Date | string | null;
    estado: string;
    factura: string | null;
    compra: string;
    pares_detalle: string | number;
  }>(
    `
    SELECT
      t.id,
      t.numero_registro,
      t.fecha_traspaso,
      t.estado,
      t.documento_ref AS factura,
      COALESCE(cl.numero_registro, '—') AS compra,
      COALESCE(
        (SELECT SUM(td.cantidad) FROM traspaso_detalle td WHERE td.traspaso_id = t.id),
        0
      ) AS pares_detalle
    FROM traspaso t
    LEFT JOIN compra_legal cl ON cl.id = t.compra_legal_id
    ${where}
    ORDER BY t.fecha_traspaso DESC, t.id DESC
    `,
    params,
  );

  return rows.map((r) => ({
    id: r.id,
    numero_registro: r.numero_registro,
    fecha_traspaso: r.fecha_traspaso ? String(r.fecha_traspaso).slice(0, 10) : null,
    estado: r.estado,
    factura: r.factura || "—",
    compra: r.compra,
    pares_detalle: Number(r.pares_detalle) || 0,
  }));
}

/** get_traspaso_detail — rechaza traspasos fuera de cliente 5000 */
export async function getTraspasoDetail(idTrp: number): Promise<TraspasoDetail | null> {
  const pool = getRimecPool();
  const { sql: clienteSql, params } = bindClienteWebParams([idTrp]);
  const { rows } = await pool.query<{
    id: number;
    numero_registro: string;
    fecha_traspaso: Date | string | null;
    estado: string;
    factura: string | null;
    snapshot_json: unknown;
    compra: string;
  }>(
    `
    SELECT
      t.id, t.numero_registro, t.fecha_traspaso, t.estado,
      t.documento_ref AS factura, t.snapshot_json,
      COALESCE(cl.numero_registro, '—') AS compra
    FROM traspaso t
    LEFT JOIN compra_legal cl ON cl.id = t.compra_legal_id
    WHERE t.id = $1
    ${clienteSql}
    `,
    params,
  );

  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: r.id,
    numero_registro: r.numero_registro,
    fecha_traspaso: r.fecha_traspaso ? String(r.fecha_traspaso).slice(0, 10) : null,
    estado: r.estado,
    factura: r.factura || "—",
    compra: r.compra,
    snapshot: parseSnapshot(r.snapshot_json),
  };
}

/** get_traspaso_detalle_lines — con fallback snapshot_json (OT-2026-021) */
export async function getTraspasoDetalleLines(idTrp: number): Promise<TraspasoDetalleLine[]> {
  const pool = getRimecPool();
  const { rows } = await pool.query<{
    id: number;
    combinacion_id: number;
    linea: string;
    referencia: string;
    material: string | null;
    color: string | null;
    talla: string;
    cantidad: number;
    caso_nombre: string | null;
  }>(
    `
    SELECT
      td.id,
      td.combinacion_id,
      l.codigo_proveedor::text AS linea,
      r.codigo_proveedor::text AS referencia,
      mat.descripcion AS material,
      col.nombre AS color,
      tl.talla_etiqueta AS talla,
      td.cantidad,
      COALESCE(pl.nombre_caso_aplicado, '—') AS caso_nombre
    FROM traspaso_detalle td
    JOIN combinacion c ON c.id = td.combinacion_id
    JOIN linea l ON l.id = c.linea_id
    JOIN referencia r ON r.id = c.referencia_id
    LEFT JOIN material mat ON mat.id = c.material_id
    LEFT JOIN color col ON col.id = c.color_id
    JOIN talla tl ON tl.id = c.talla_id
    LEFT JOIN traspaso t ON t.id = td.traspaso_id
    LEFT JOIN factura_interna fi ON fi.nro_factura = t.documento_ref
    LEFT JOIN pedido_proveedor pp ON pp.id = fi.pp_id
    LEFT JOIN intencion_compra_pedido icp ON icp.pedido_proveedor_id = pp.id
    LEFT JOIN precio_lista pl ON pl.evento_id = icp.precio_evento_id
      AND pl.linea_codigo = l.codigo_proveedor::text
      AND pl.referencia_codigo = r.codigo_proveedor::text
    WHERE td.traspaso_id = $1
    ORDER BY l.codigo_proveedor, r.codigo_proveedor, tl.talla_etiqueta
    `,
    [idTrp],
  );

  if (rows.length) {
    return rows.map((r) => ({
      id: r.id,
      combinacion_id: r.combinacion_id,
      linea: r.linea,
      referencia: r.referencia,
      material: r.material || "—",
      color: r.color || "—",
      talla: r.talla,
      cantidad: Number(r.cantidad) || 0,
      caso_nombre: r.caso_nombre || "—",
    }));
  }

  const snapRes = await pool.query<{ snapshot_json: unknown; caso_nombre: string | null }>(
    `
    SELECT
      t.snapshot_json,
      MAX(pl.nombre_caso_aplicado) AS caso_nombre
    FROM traspaso t
    LEFT JOIN factura_interna fi ON fi.nro_factura = t.documento_ref
    LEFT JOIN pedido_proveedor pp ON pp.id = fi.pp_id
    LEFT JOIN intencion_compra_pedido icp ON icp.pedido_proveedor_id = pp.id
    LEFT JOIN precio_lista pl ON pl.evento_id = icp.precio_evento_id
    WHERE t.id = $1
    GROUP BY t.id, t.snapshot_json
    `,
    [idTrp],
  );

  if (!snapRes.rows.length || !snapRes.rows[0].snapshot_json) return [];

  const snapshot = parseSnapshot(snapRes.rows[0].snapshot_json);
  const caso = snapRes.rows[0].caso_nombre || "—";
  return expandSnapshotLines(snapshot, caso);
}

/** get_fi_registro_por_numero — facturacion/logic.py */
export async function getFiRegistroPorNumero(nroFactura: string): Promise<FiRegistroRow | null> {
  const nro = nroFactura.trim();
  let whereClause: string;
  let params: unknown[];

  if (nro.startsWith("PV") && nro.length >= 3 && /^\d+$/.test(nro.slice(2))) {
    whereClause = "WHERE fi.pv_global = $1";
    params = [parseInt(nro.slice(2), 10)];
  } else {
    whereClause = "WHERE fi.nro_factura = $1";
    params = [nro];
  }

  const pool = getRimecPool();
  const { rows } = await pool.query<FiRegistroRow>(
    `
    SELECT
      fi.id, fi.nro_factura, fi.pv_global, fi.estado, fi.created_at,
      fi.pp_id,
      pp.numero_registro AS nro_pp,
      fi.marca, fi.caso,
      cv.descp_cliente AS cliente,
      vv.descp_usuario AS vendedor,
      fi.total_pares,
      fi.total_monto,
      fi.lista_precio_id,
      fi.descuento_1, fi.descuento_2, fi.descuento_3, fi.descuento_4
    FROM factura_interna fi
    LEFT JOIN pedido_proveedor pp ON pp.id = fi.pp_id
    LEFT JOIN cliente_v2 cv ON cv.id_cliente = fi.cliente_id
    LEFT JOIN usuario_v2 vv ON vv.id_usuario = fi.vendedor_id
    ${whereClause}
    LIMIT 1
    `,
    params,
  );

  return rows[0] ?? null;
}

/** get_fi_detalles_canonico — pedido_proveedor/logic.py */
export async function getFiDetallesCanonico(fiId: number): Promise<FiDetalleCanonico[]> {
  const pool = getRimecPool();
  const { rows } = await pool.query<{
    id: number;
    pares: number;
    cajas: number;
    precio_unit: number | null;
    subtotal: number | null;
    precio_neto: number | null;
    linea_snapshot: unknown;
  }>(
    `
    SELECT fid.id, fid.pares, fid.cajas, fid.precio_unit,
           fid.subtotal, fid.precio_neto, fid.linea_snapshot
    FROM factura_interna_detalle fid
    WHERE fid.factura_id = $1
    ORDER BY fid.id
    `,
    [fiId],
  );

  return rows.map((r) => ({
    id: r.id,
    pares: Number(r.pares) || 0,
    cajas: Number(r.cajas) || 0,
    precio_unit: r.precio_unit != null ? Number(r.precio_unit) : null,
    subtotal: r.subtotal != null ? Number(r.subtotal) : null,
    precio_neto: r.precio_neto != null ? Number(r.precio_neto) : null,
    linea_snapshot: parseSnapshot(r.linea_snapshot),
  }));
}

/** get_factura_lineas — legacy fallback facturacion/logic.py */
export async function getFacturaLineas(numeroFactura: string): Promise<FacturaLineaLegacy[]> {
  const pool = getRimecPool();
  const { rows } = await pool.query<FacturaLineaLegacy>(
    `
    SELECT linea, referencia, material, color, grada,
           t33, t34, t35, t36, t37, t38, t39, t40, pares
    FROM (
      SELECT
        ppd.linea,
        ppd.referencia,
        ppd.descp_material AS material,
        ppd.descp_color AS color,
        ppd.grada,
        SUM(vt.t33)::int AS t33, SUM(vt.t34)::int AS t34,
        SUM(vt.t35)::int AS t35, SUM(vt.t36)::int AS t36,
        SUM(vt.t37)::int AS t37, SUM(vt.t38)::int AS t38,
        SUM(vt.t39)::int AS t39, SUM(vt.t40)::int AS t40,
        SUM(vt.cantidad_vendida)::int AS pares
      FROM venta_transito vt
      JOIN pedido_proveedor_detalle ppd ON ppd.id = vt.pedido_proveedor_detalle_id
      WHERE vt.numero_factura_interna = $1
      GROUP BY ppd.linea, ppd.referencia, ppd.descp_material, ppd.descp_color, ppd.grada

      UNION ALL

      SELECT
        ppd.linea,
        ppd.referencia,
        COALESCE(fid.linea_snapshot->>'material_nombre', ppd.descp_material, '—') AS material,
        COALESCE(fid.linea_snapshot->>'color_nombre', ppd.descp_color, '—') AS color,
        ppd.grada,
        0 AS t33, 0 AS t34, 0 AS t35, 0 AS t36,
        0 AS t37, 0 AS t38, 0 AS t39, 0 AS t40,
        SUM(fid.pares)::int AS pares
      FROM factura_interna fi
      JOIN factura_interna_detalle fid ON fid.factura_id = fi.id
      JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
      WHERE fi.nro_factura = $1
        AND fi.estado IN ('CONFIRMADA', 'RESERVADA')
      GROUP BY ppd.linea, ppd.referencia,
               fid.linea_snapshot->>'material_nombre',
               fid.linea_snapshot->>'color_nombre',
               ppd.descp_material, ppd.descp_color, ppd.grada
    ) u
    ORDER BY linea, referencia
    `,
    [numeroFactura],
  );

  return rows.map((r) => ({
    ...r,
    t33: Number(r.t33) || 0,
    t34: Number(r.t34) || 0,
    t35: Number(r.t35) || 0,
    t36: Number(r.t36) || 0,
    t37: Number(r.t37) || 0,
    t38: Number(r.t38) || 0,
    t39: Number(r.t39) || 0,
    t40: Number(r.t40) || 0,
    pares: Number(r.pares) || 0,
  }));
}

/** Valida que el traspaso pertenezca al cliente web 5000 (confirmar recepción) */
export async function traspasoEsClienteWeb(idTrp: number): Promise<boolean> {
  const pool = getRimecPool();
  const { sql: clienteSql, params } = bindClienteWebParams([idTrp]);
  const { rows } = await pool.query<{ ok: number }>(
    `SELECT 1 AS ok FROM traspaso t WHERE t.id = $1 ${clienteSql} LIMIT 1`,
    params,
  );
  return rows.length > 0;
}

/** Resumen métricas lista (gemelo UI Streamlit) */
export function summarizeTraspasos(items: TraspasoListItem[]) {
  return {
    total: items.length,
    enviados: items.filter((t) => t.estado === "ENVIADO").length,
    confirmados: items.filter((t) => t.estado === "CONFIRMADO").length,
  };
}
