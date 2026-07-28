import type { Pool, PoolClient } from "pg";
import type { LogisticaPendienteRow } from "@/lib/logistica-ok/queries-bandeja";
import {
  ENTIDAD_AM_META,
  FECHA_ENTREGA_CLIENTE_LABEL,
  type EntidadAmLogistica,
  type LogisticaTabId,
} from "@/lib/logistica-ok/constants";
import { diasAtrasoDesdePublicacion } from "@/lib/logistica-ok/queries-bandeja";
import type { ExcelRimecParseResult } from "./parse-excel-rimec";
import type { FiDetalleCanonico, FiRegistroRow } from "@/lib/bazzar-web/compra-web/types";
import {
  nombreVendedorCarlos,
  resolveVendedorDesdeCodigoCarlos,
} from "./vendedor-carlos";

export { groupLogisticaRimecPorEntidad } from "./group-entidad";

export type LogisticaRimecRow = {
  id: number;
  lote_id: number;
  factura_carlos: string;
  fecha_factura: string;
  codigo_cliente_carlos: number;
  id_cliente: number | null;
  cliente: string;
  codigo_vendedor_carlos: number;
  id_vendedor: number | null;
  vendedor: string;
  lista_precio: string | null;
  ped_pv: string | null;
  ped_cli: string | null;
  nro_pedido_externo: string | null;
  entidad_am: EntidadAmLogistica;
  observacion: string | null;
  pares: number;
  monto_neto: number;
  n_articulos: number;
  origen: string;
  estado: string;
  fecha_entrega_vendedor: string | null;
  pendiente_impresion_legal: boolean;
  impresion_legal_ok: boolean;
  pendiente_entrega: boolean;
  entregado_ok: boolean;
  fecha_entrega_efectiva: string | null;
  chofer_nombre: string | null;
  created_at: string | null;
};

function tabToEstado(tab: LogisticaTabId): string | null {
  switch (tab) {
    case "confirmadas":
      return "CONFIRMADA";
    case "entregas":
      return "EN_ENTREGA";
    case "exitosas":
    case "general_exitoso":
      return "EXITOSA";
    case "general":
    case "vendedor":
    default:
      return "PENDIENTE";
  }
}

export function rimecToPendienteRow(r: LogisticaRimecRow): LogisticaPendienteRow {
  const pares = Number(r.pares) || 0;
  const cajas = pares > 0 ? Math.max(1, Math.ceil(pares / 12)) : 0;
  const idCliente = r.id_cliente ?? r.codigo_cliente_carlos;
  const entidad = (r.entidad_am || "CP") as EntidadAmLogistica;
  const pedidoExt = r.nro_pedido_externo || r.ped_cli || r.ped_pv || r.factura_carlos;
  /** Col F = código Carlos · id_vendedor = Nexus (vendedor_v2) para agrupar por persona. */
  const codigoVend = Number(r.codigo_vendedor_carlos) || 0;
  const resolved = resolveVendedorDesdeCodigoCarlos(codigoVend);
  const nombreVend = nombreVendedorCarlos(
    codigoVend,
    r.vendedor && !/^VEND\s/i.test(r.vendedor) && r.vendedor !== "—"
      ? r.vendedor
      : null,
  );
  return {
    id: r.id,
    factura_interna_id: 0,
    pedido_proveedor_id: r.id,
    entidad_am: entidad,
    fecha_orden: r.fecha_factura,
    id_cliente: idCliente,
    id_cadena: null,
    id_vendedor: resolved.idNexus ?? (r.id_vendedor ?? null),
    codigo_vendedor_carlos: codigoVend > 0 ? codigoVend : null,
    pares,
    cajas,
    monto_neto: Number(r.monto_neto) || 0,
    nro_factura: r.factura_carlos,
    factura_real: r.factura_carlos,
    factura_carlos: r.factura_carlos,
    pv_global: null,
    fecha_entrega_cliente: r.fecha_entrega_vendedor,
    fecha_entrega_vendedor: r.fecha_entrega_vendedor,
    estado: r.estado,
    pendiente_impresion_legal: r.pendiente_impresion_legal,
    impresion_legal_ok: r.impresion_legal_ok,
    pendiente_entrega: r.pendiente_entrega,
    entregado_ok: r.entregado_ok,
    fecha_entrega_efectiva: r.fecha_entrega_efectiva,
    chofer_nombre: r.chofer_nombre,
    registro_at: r.created_at,
    cliente: r.cliente,
    cadena: null,
    vendedor: nombreVend,
    pp_numero: r.factura_carlos,
    nro_pedido_externo: String(pedidoExt),
    marca: r.lista_precio || "Carlos",
    quincena_arribo_id: null,
    quincena_desc: ENTIDAD_AM_META[entidad]?.label ?? entidad,
    etiqueta_cadena: "—",
    pp_publicado_at: r.fecha_factura,
    dias_atraso: diasAtrasoDesdePublicacion(r.fecha_factura),
    obs_count: r.observacion ? 1 : 0,
    obs_no_leida: Boolean(r.observacion),
  };
}

export async function listLogisticaRimecPendientes(
  pool: Pool,
  opts?: { estado?: string | null; tab?: LogisticaTabId },
): Promise<LogisticaRimecRow[]> {
  const estado =
    opts?.tab != null
      ? tabToEstado(opts.tab)
      : opts?.estado === "TODOS"
        ? null
        : (opts?.estado ?? "PENDIENTE");
  const params: unknown[] = [];
  let where = "WHERE 1=1";
  if (estado) {
    params.push(estado);
    where += ` AND l.estado = $${params.length}`;
  }
  const r = await pool.query<LogisticaRimecRow>(
    `SELECT
       l.id, l.lote_id, l.factura_carlos,
       l.fecha_factura::text AS fecha_factura,
       l.codigo_cliente_carlos, l.id_cliente,
       COALESCE(NULLIF(BTRIM(c.descp_cliente), ''), 'CLI '||l.codigo_cliente_carlos::text) AS cliente,
       l.codigo_vendedor_carlos, l.id_vendedor,
       COALESCE(
         NULLIF(BTRIM(vd.descp_vendedor), ''),
         'VEND '||l.codigo_vendedor_carlos::text
       ) AS vendedor,
       l.lista_precio, l.ped_pv, l.ped_cli,
       l.nro_pedido_externo, l.entidad_am, l.observacion,
       l.pares, l.monto_neto::float8 AS monto_neto, l.n_articulos,
       l.origen, l.estado,
       l.fecha_entrega_vendedor::text AS fecha_entrega_vendedor,
       l.pendiente_impresion_legal, l.impresion_legal_ok,
       l.pendiente_entrega, l.entregado_ok,
       l.fecha_entrega_efectiva::text AS fecha_entrega_efectiva,
       l.chofer_nombre,
       l.created_at::text AS created_at
     FROM logistica_rimec_pendiente l
     LEFT JOIN cliente_v2 c ON c.id_cliente = l.id_cliente
     LEFT JOIN vendedor_v2 vd ON vd.id_vendedor = l.id_vendedor
     ${where}
     ORDER BY l.fecha_factura ASC, l.factura_carlos ASC`,
    params,
  );
  return r.rows.map((row) => {
    const resolved = resolveVendedorDesdeCodigoCarlos(row.codigo_vendedor_carlos);
    const nombre =
      row.vendedor && !String(row.vendedor).startsWith("VEND ")
        ? row.vendedor
        : resolved.nombreCanon;
    return { ...row, vendedor: nombre };
  });
}

export async function listLogisticaRimecAsPendiente(
  pool: Pool,
  opts?: { estado?: string | null; tab?: LogisticaTabId },
): Promise<LogisticaPendienteRow[]> {
  const rows = await listLogisticaRimecPendientes(pool, opts);
  return rows.map(rimecToPendienteRow);
}

export async function importExcelRimec(
  pool: Pool,
  parsed: ExcelRimecParseResult,
  opts: { archivoNombre: string; usuarioId: number | null },
): Promise<{ loteId: number; insertadas: number; actualizadas: number }> {
  const client = await pool.connect();
  let insertadas = 0;
  let actualizadas = 0;
  try {
    await client.query("BEGIN");
    // Limpia lote previo Excel Rimec (reimport limpio)
    await client.query(`DELETE FROM logistica_rimec_detalle`);
    await client.query(`DELETE FROM logistica_rimec_pendiente`);
    await client.query(`DELETE FROM logistica_rimec_lote`);

    const loteRes = await client.query<{ id: string }>(
      `INSERT INTO logistica_rimec_lote
        (archivo_nombre, periodo_label, n_facturas, n_articulos, monto_total, pares_total, importado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        opts.archivoNombre,
        `Excel · PE ${parsed.stats.porTipo.PE || 0} · PROG ${parsed.stats.porTipo.PROGRAMADO || 0} · CP ${parsed.stats.porTipo.CP || 0}`,
        parsed.stats.facturas,
        parsed.stats.articulos,
        parsed.stats.montoTotal,
        parsed.stats.paresTotal,
        opts.usuarioId,
      ],
    );
    const loteId = Number(loteRes.rows[0]!.id);

    for (const c of parsed.cabeceras) {
      const idCliente = await resolveClienteId(client, c.codigoCliente);
      const idVendedor = await resolveVendedorId(client, c.codigoVendedor);
      const up = await client.query<{ id: string }>(
        `INSERT INTO logistica_rimec_pendiente (
           lote_id, factura_carlos, fecha_factura,
           codigo_cliente_carlos, id_cliente,
           codigo_vendedor_carlos, id_vendedor,
           lista_precio, ped_pv, ped_cli, nro_pedido_externo,
           entidad_am, observacion,
           pares, monto_neto, n_articulos, origen, estado
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'EXCEL_RIMEC','PENDIENTE'
         )
         RETURNING id`,
        [
          loteId,
          c.facturaCarlos,
          c.fecha,
          c.codigoCliente,
          idCliente,
          c.codigoVendedor,
          idVendedor,
          c.listaPrecio,
          c.facturaPv,
          c.nroPedidoExterno,
          c.nroPedidoExterno,
          c.entidadAm,
          c.observacion || null,
          c.cantTotal,
          c.montoNeto,
          c.articulos.length,
        ],
      );
      const pendId = Number(up.rows[0]!.id);
      insertadas += 1;
      for (const a of c.articulos) {
        const [linea, ref] = (a.lineaRef || "").split(/[-–]/);
        await client.query(
          `INSERT INTO logistica_rimec_detalle
            (pendiente_id, articulo, descripcion, cant_vend, p_venta_gs, t_venta_gs,
             linea_ref, material_code, color_code, grada, monto_unitario)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            pendId,
            a.articulo,
            a.lineaRef || a.articulo,
            a.cantVend,
            a.pVentaGs,
            a.tVentaGs,
            a.lineaRef,
            a.materialCode,
            a.colorCode,
            a.grada,
            a.pVentaGs,
          ],
        );
        void linea;
        void ref;
      }
    }

    await client.query("COMMIT");
    return { loteId, insertadas, actualizadas };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function getRimecDetalleComoFi(
  pool: Pool,
  facturaCarlos: string,
): Promise<{ fi: FiRegistroRow; detalles: FiDetalleCanonico[] } | null> {
  const cab = await pool.query<LogisticaRimecRow>(
    `SELECT
       l.id, l.lote_id, l.factura_carlos,
       l.fecha_factura::text AS fecha_factura,
       l.codigo_cliente_carlos, l.id_cliente,
       COALESCE(NULLIF(BTRIM(c.descp_cliente), ''), 'CLI '||l.codigo_cliente_carlos::text) AS cliente,
       l.codigo_vendedor_carlos, l.id_vendedor,
       COALESCE(
         NULLIF(BTRIM(vd.descp_vendedor), ''),
         'VEND '||l.codigo_vendedor_carlos::text
       ) AS vendedor,
       l.lista_precio, l.ped_pv, l.ped_cli,
       l.nro_pedido_externo, l.entidad_am, l.observacion,
       l.pares, l.monto_neto::float8 AS monto_neto, l.n_articulos,
       l.origen, l.estado,
       l.fecha_entrega_vendedor::text AS fecha_entrega_vendedor,
       l.pendiente_impresion_legal, l.impresion_legal_ok,
       l.pendiente_entrega, l.entregado_ok,
       l.fecha_entrega_efectiva::text AS fecha_entrega_efectiva,
       l.chofer_nombre,
       l.created_at::text AS created_at
     FROM logistica_rimec_pendiente l
     LEFT JOIN cliente_v2 c ON c.id_cliente = l.id_cliente
     LEFT JOIN vendedor_v2 vd ON vd.id_vendedor = l.id_vendedor
     WHERE l.factura_carlos = $1
     LIMIT 1`,
    [facturaCarlos],
  );
  if (!cab.rows[0]) return null;
  const r = cab.rows[0];
  const dets = await pool.query<{
    id: string;
    articulo: string;
    descripcion: string | null;
    cant_vend: number;
    p_venta_gs: number;
    t_venta_gs: number;
    linea_ref: string | null;
    material_code: string | null;
    color_code: string | null;
    grada: string | null;
  }>(
    `SELECT id, articulo, descripcion, cant_vend, p_venta_gs::float8 AS p_venta_gs,
            t_venta_gs::float8 AS t_venta_gs, linea_ref, material_code, color_code, grada
     FROM logistica_rimec_detalle WHERE pendiente_id = $1 ORDER BY id`,
    [r.id],
  );

  const fi: FiRegistroRow = {
    id: r.id,
    nro_factura: r.factura_carlos,
    pv_global: r.ped_pv ? Number(r.ped_pv) || null : null,
    estado: r.estado,
    pp_id: null,
    cliente_id: r.id_cliente,
    nro_pp: r.nro_pedido_externo,
    marca: r.lista_precio,
    caso: ENTIDAD_AM_META[r.entidad_am]?.label ?? r.entidad_am,
    cliente: r.cliente,
    vendedor: r.vendedor,
    total_pares: r.pares,
    total_monto: r.monto_neto,
    lista_precio_id: null,
    descuento_1: 0,
    descuento_2: 0,
    descuento_3: 0,
    descuento_4: 0,
    created_at: r.created_at,
  };

  const detalles: FiDetalleCanonico[] = dets.rows.map((d) => {
    const parts = String(d.linea_ref || "").split(/[-–]/);
    const linea = (parts[0] || "").trim();
    const ref = (parts[1] || "").trim();
    return {
      id: Number(d.id),
      pares: Number(d.cant_vend) || 0,
      cajas: Math.max(1, Math.ceil((Number(d.cant_vend) || 0) / 12)),
      precio_unit: Number(d.p_venta_gs) || null,
      subtotal: Number(d.t_venta_gs) || null,
      precio_neto: Number(d.t_venta_gs) || null,
      linea_snapshot: {
        linea_codigo: linea,
        ref_codigo: ref,
        material_code: d.material_code || "",
        color_code: d.color_code || "",
        material_codigo: d.material_code || "",
        color_codigo: d.color_code || "",
        gradas_display: d.grada || "",
        grada: d.grada || "",
        codigo_articulo: d.articulo,
        art_carlos: d.articulo,
      },
    };
  });

  return { fi, detalles };
}

export async function confirmarFechaRimec(
  pool: Pool,
  pendienteId: number,
  fechaEntrega: string,
  usuarioId: number | null,
  idVendedor?: number | null,
): Promise<{ ok: boolean; error?: string }> {
  const fecha = fechaEntrega?.trim().slice(0, 10);
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number(fecha.slice(0, 4)) < 2000) {
    return { ok: false, error: `${FECHA_ENTREGA_CLIENTE_LABEL} inválida (año ≥ 2000).` };
  }
  const { rowCount } = await pool.query(
    `UPDATE logistica_rimec_pendiente SET
       fecha_entrega_vendedor = $2::date,
       estado = 'CONFIRMADA',
       pendiente_impresion_legal = true,
       impresion_legal_ok = false,
       pendiente_entrega = true,
       entregado_ok = false,
       id_vendedor = COALESCE($4, id_vendedor),
       confirmado_at = now(),
       confirmado_por = $3,
       updated_at = now()
     WHERE id = $1 AND estado = 'PENDIENTE'`,
    [pendienteId, fecha, usuarioId, idVendedor ?? null],
  );
  if (!rowCount) return { ok: false, error: "Pendiente no encontrado o ya confirmado." };
  return { ok: true };
}

export async function confirmarFechaRimecLote(
  pool: Pool,
  ids: number[],
  fechaEntrega: string,
  usuarioId: number | null,
  idVendedor?: number | null,
): Promise<{ ok: boolean; done: number; okIds: number[]; skipped: number; error?: string }> {
  const fecha = fechaEntrega?.trim().slice(0, 10);
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number(fecha.slice(0, 4)) < 2000) {
    return {
      ok: false,
      done: 0,
      okIds: [],
      skipped: 0,
      error: `${FECHA_ENTREGA_CLIENTE_LABEL} inválida (año ≥ 2000).`,
    };
  }
  const uniq = [...new Set(ids.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
  if (!uniq.length) {
    return { ok: false, done: 0, okIds: [], skipped: 0, error: "Seleccioná al menos una factura." };
  }
  const { rows } = await pool.query<{ id: string }>(
    `UPDATE logistica_rimec_pendiente SET
       fecha_entrega_vendedor = $2::date,
       estado = 'CONFIRMADA',
       pendiente_impresion_legal = true,
       impresion_legal_ok = false,
       pendiente_entrega = true,
       entregado_ok = false,
       id_vendedor = COALESCE($4, id_vendedor),
       confirmado_at = now(),
       confirmado_por = $3,
       updated_at = now()
     WHERE id = ANY($1::bigint[]) AND estado = 'PENDIENTE'
     RETURNING id`,
    [uniq, fecha, usuarioId, idVendedor ?? null],
  );
  const okIds = rows.map((r) => Number(r.id));
  return {
    ok: okIds.length > 0,
    done: okIds.length,
    okIds,
    skipped: uniq.length - okIds.length,
  };
}

export async function confirmarImpresionLegalRimec(
  pool: Pool,
  id: number,
  usuarioId: number | null,
): Promise<{ ok: boolean; error?: string }> {
  const { rowCount } = await pool.query(
    `UPDATE logistica_rimec_pendiente SET
       impresion_legal_ok = true,
       pendiente_impresion_legal = false,
       estado = 'EN_ENTREGA',
       updated_at = now(),
       confirmado_por = COALESCE($2, confirmado_por)
     WHERE id = $1 AND estado = 'CONFIRMADA'`,
    [id, usuarioId],
  );
  if (!rowCount) return { ok: false, error: "No está en CONFIRMADA o ya impresa." };
  return { ok: true };
}

export async function confirmarImpresionLegalRimecLote(
  pool: Pool,
  ids: number[],
  usuarioId: number | null,
): Promise<{ ok: boolean; done: number; okIds: number[]; skipped: number; error?: string }> {
  const uniq = [...new Set(ids.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
  if (!uniq.length) {
    return { ok: false, done: 0, okIds: [], skipped: 0, error: "Seleccioná al menos una factura." };
  }
  const { rows } = await pool.query<{ id: string }>(
    `UPDATE logistica_rimec_pendiente SET
       impresion_legal_ok = true,
       pendiente_impresion_legal = false,
       estado = 'EN_ENTREGA',
       updated_at = now(),
       confirmado_por = COALESCE($2, confirmado_por)
     WHERE id = ANY($1::bigint[]) AND estado = 'CONFIRMADA'
     RETURNING id`,
    [uniq, usuarioId],
  );
  const okIds = rows.map((r) => Number(r.id));
  return {
    ok: okIds.length > 0,
    done: okIds.length,
    okIds,
    skipped: uniq.length - okIds.length,
  };
}

export async function cerrarEntregaExitosaRimec(
  pool: Pool,
  id: number,
  opts: { fecha_entrega_efectiva: string; chofer_nombre: string; usuarioId: number | null },
): Promise<{ ok: boolean; error?: string }> {
  const fecha = opts.fecha_entrega_efectiva?.trim().slice(0, 10);
  const chofer = opts.chofer_nombre?.trim();
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return { ok: false, error: "Fecha de la entrega inválida." };
  }
  if (!chofer) return { ok: false, error: "Chofer obligatorio." };
  const { rowCount } = await pool.query(
    `UPDATE logistica_rimec_pendiente SET
       fecha_entrega_efectiva = $2::date,
       chofer_nombre = $3,
       entregado_ok = true,
       pendiente_entrega = false,
       estado = 'EXITOSA',
       updated_at = now(),
       confirmado_por = COALESCE($4, confirmado_por)
     WHERE id = $1 AND estado = 'EN_ENTREGA'`,
    [id, fecha, chofer, opts.usuarioId],
  );
  if (!rowCount) return { ok: false, error: "No está en EN_ENTREGA." };
  return { ok: true };
}

async function resolveClienteId(client: PoolClient, codigo: number): Promise<number | null> {
  const r = await client.query<{ id_cliente: number }>(
    `SELECT id_cliente FROM cliente_v2 WHERE id_cliente = $1 LIMIT 1`,
    [codigo],
  );
  return r.rows[0]?.id_cliente ?? null;
}

async function resolveVendedorId(client: PoolClient, codigoCarlos: number): Promise<number | null> {
  const resolved = resolveVendedorDesdeCodigoCarlos(codigoCarlos);
  if (resolved.idNexus != null) {
    const r = await client.query<{ id: number }>(
      `SELECT id_vendedor AS id FROM vendedor_v2 WHERE id_vendedor = $1 LIMIT 1`,
      [resolved.idNexus],
    );
    if (r.rows[0]) return r.rows[0].id;
  }
  // Match por nombre canónico (sin colisionar con usuario_v2)
  if (resolved.nombreCanon && !resolved.nombreCanon.startsWith("VEND ")) {
    const base = resolved.nombreCanon.split(/\s+/)[0]!.replace(/\.$/, "");
    const r = await client.query<{ id: number }>(
      `SELECT id_vendedor AS id FROM vendedor_v2
       WHERE UPPER(BTRIM(descp_vendedor)) = UPPER(BTRIM($1))
          OR UPPER(BTRIM(descp_vendedor)) LIKE UPPER(BTRIM($2)) || '%'
       ORDER BY id_vendedor
       LIMIT 1`,
      [resolved.nombreCanon, base],
    );
    if (r.rows[0]) return r.rows[0].id;
  }
  return null;
}
