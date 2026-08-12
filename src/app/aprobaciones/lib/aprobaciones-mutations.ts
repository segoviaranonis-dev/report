import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { anularYReintegrarFi } from "@/lib/facturacion/anular-reintegrar-fi";
import { syncLogisticaTrasConfirmarFi } from "@/lib/logistica-ok/sync-pp";
import { listaPrecioLabel, precioNetoCascada } from "./aprobaciones-utils";
import {
  sumFiTotalesDesdeDetalle,
  syncPedidoEncabezadoDesdeFi,
  syncPedidoListaSiUnicaFi,
  syncPedidoTotalesDesdeFis,
} from "./fi-editor-sync";
import {
  lockFiEditable,
  recalcularFiTotalesYsyncPvr,
  restoreFiEstadoTrasEdicion,
} from "./fi-edit-guard";
import {
  sqlPrecioBaseFiDetalle,
  sqlPrecioBaseFiDetalleConFallbackPe,
  sqlPrecioBaseFiDetalleSoloEvento,
  sqlFromFiDetallePrecioEventoOverride,
  SQL_FROM_FI_DETALLE_PRECIO,
  sqlPrecioComercialDesdePl,
} from "./fi-precio-evento-lookup";
import { resolveCasoDominanteDesdePpd } from "@/lib/pedido-proveedor/resolve-caso-cabecera-fi";
import { esListadoPrecioValido } from "@/lib/intencion-compra/listado-precio-tiers";

export type MutationResult = {
  ok: boolean;
  msg: string;
  /** PP para sync logística post-respuesta (no bloquear botón Confirmar). */
  ppIdLogistica?: number | null;
  logistica?: {
    ok: boolean;
    entidad?: string;
    synced?: number;
    error?: string;
    skipped?: boolean;
    pending?: boolean;
  };
};

/**
 * confirmar_fi() — COMMIT rápido.
 * Logística OK se dispara en el route handler con `after()` (no bloquea el botón).
 */
export async function confirmarFi(fiId: number): Promise<MutationResult> {
  if (!isRimecDatabaseConfigured()) {
    return { ok: false, msg: "DATABASE_URL no configurada." };
  }

  const pool = getRimecPool();
  const client = await pool.connect();
  let ppIdLogistica: number | null = null;
  try {
    await client.query("BEGIN");

    const pedidoRes = await client.query<{ pedido_id: number | null; pp_id: number | null }>(
      `SELECT pedido_id, pp_id FROM public.factura_interna WHERE id = $1 LIMIT 1`,
      [fiId]
    );
    const pedidoId = pedidoRes.rows[0]?.pedido_id ?? null;
    // Logística OK exige pp_id real > 0 (contrato PE · pe-pp-contrato.ts)
    ppIdLogistica =
      pedidoRes.rows[0]?.pp_id != null && Number(pedidoRes.rows[0].pp_id) > 0
        ? Number(pedidoRes.rows[0].pp_id)
        : null;

    const updateRes = await client.query(
      `UPDATE public.factura_interna
       SET estado = 'CONFIRMADA', fecha_confirmacion = NOW()
       WHERE id = $1 AND estado = 'RESERVADA'`,
      [fiId],
    );

    if ((updateRes.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      return { ok: false, msg: "FI no encontrada o ya no está en estado RESERVADA." };
    }

    let pedidoCompleto = false;
    if (pedidoId) {
      const countRes = await client.query<{ total: string; confirmadas: string }>(
        `SELECT COUNT(*)::text AS total,
                SUM(CASE WHEN UPPER(TRIM(estado)) = 'CONFIRMADA' THEN 1 ELSE 0 END)::text AS confirmadas
         FROM public.factura_interna WHERE pedido_id = $1`,
        [pedidoId]
      );
      const total = parseInt(countRes.rows[0]?.total ?? "0", 10);
      const confirmadas = parseInt(countRes.rows[0]?.confirmadas ?? "0", 10);
      if (total > 0 && total === confirmadas) {
        await client.query(
          `UPDATE public.pedido_venta_rimec SET estado = 'CONFIRMADO' WHERE id = $1 AND estado = 'PENDIENTE'`,
          [pedidoId]
        );
        pedidoCompleto = true;
      }
    }

    await client.query("COMMIT");

    let msg = "FI confirmada.";
    if (pedidoCompleto) {
      msg += " Pedido CONFIRMADO.";
    }
    if (ppIdLogistica != null) {
      msg += " Logística en segundo plano…";
    }
    return {
      ok: true,
      msg,
      ppIdLogistica,
      logistica: ppIdLogistica != null ? { ok: true, pending: true } : undefined,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, msg: e instanceof Error ? e.message : String(e) };
  } finally {
    client.release();
  }
}

export type AprobacionGeneralResult = {
  ok: boolean;
  msg: string;
  pedidosOk: number;
  pedidosFail: number;
  fisOk: number;
  fisFail: number;
  /** Pares para after() logística — misma ruta que confirmar individual. */
  logisticaQueue: Array<{ fiId: number; ppId: number }>;
  errores: string[];
};

/**
 * Aprobación Gral — misma ruta que ✓ Aprobar por FI (`confirmarFi`),
 * acotada a la(s) molécula(s)/pedido(s) indicados (familia FI interna).
 * UI: un botón por tarjeta pendiente — no aprueba toda la lista.
 */
export async function aprobacionGeneral(
  pedidoIds: number[],
): Promise<AprobacionGeneralResult> {
  const empty: AprobacionGeneralResult = {
    ok: false,
    msg: "Sin pedidos.",
    pedidosOk: 0,
    pedidosFail: 0,
    fisOk: 0,
    fisFail: 0,
    logisticaQueue: [],
    errores: [],
  };

  const ids = [...new Set(pedidoIds.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0))];
  if (ids.length === 0) return empty;

  if (!isRimecDatabaseConfigured()) {
    return { ...empty, msg: "DATABASE_URL no configurada." };
  }

  const pool = getRimecPool();
  const fiRes = await pool.query<{ id: number; pedido_id: number }>(
    `SELECT fi.id, fi.pedido_id
     FROM public.factura_interna fi
     INNER JOIN public.pedido_venta_rimec pvr ON pvr.id = fi.pedido_id
     WHERE fi.pedido_id = ANY($1::int[])
       AND UPPER(TRIM(fi.estado)) = 'RESERVADA'
       AND UPPER(TRIM(pvr.estado)) = 'PENDIENTE'
     ORDER BY fi.pedido_id, fi.id`,
    [ids],
  );

  if (fiRes.rows.length === 0) {
    return {
      ...empty,
      msg: "No hay FI RESERVADA en los pedidos seleccionados (¿ya aprobados?).",
    };
  }

  const errores: string[] = [];
  const logisticaQueue: Array<{ fiId: number; ppId: number }> = [];
  let fisOk = 0;
  let fisFail = 0;
  const pedidosConOk = new Set<number>();
  const pedidosConFail = new Set<number>();

  for (const row of fiRes.rows) {
    const fiId = Number(row.id);
    const pedidoId = Number(row.pedido_id);
    const result = await confirmarFi(fiId);
    if (result.ok) {
      fisOk++;
      pedidosConOk.add(pedidoId);
      if (result.ppIdLogistica != null) {
        logisticaQueue.push({ fiId, ppId: result.ppIdLogistica });
      }
    } else {
      fisFail++;
      pedidosConFail.add(pedidoId);
      errores.push(`FI ${fiId}: ${result.msg}`);
    }
  }

  const pedidosOk = [...pedidosConOk].filter((p) => !pedidosConFail.has(p)).length;
  const pedidosFail = pedidosConFail.size;
  const ok = fisFail === 0 && fisOk > 0;
  const msg = ok
    ? `Aprobación Gral OK · molécula ${ids.join(",")} · ${fisOk} FI · pedido(s) ${pedidosOk} · logística en segundo plano…`
    : `Aprobación Gral parcial · molécula · OK ${fisOk} FI · fallas ${fisFail}` +
      (errores[0] ? ` · ${errores[0]}` : "");

  return {
    ok,
    msg,
    pedidosOk,
    pedidosFail,
    fisOk,
    fisFail,
    logisticaQueue,
    errores,
  };
}

/** Sync logística post-confirm (llamar desde `after()` del route). */
export async function syncLogisticaTrasConfirmarFiBackground(
  fiId: number,
  ppId: number,
): Promise<void> {
  if (!isRimecDatabaseConfigured()) return;
  const pool = getRimecPool();
  try {
    const sync = await syncLogisticaTrasConfirmarFi(pool, fiId, ppId);
    if (!sync.ok) {
      console.error(`[aprobaciones/confirmarFi] logística FI ${fiId} PP ${ppId}:`, sync.error);
    }
  } catch (e) {
    console.error(
      `[aprobaciones/confirmarFi] logística FI ${fiId} PP ${ppId}:`,
      e instanceof Error ? e.message : e,
    );
  }
}

/** anular_fi — canon 2.3.1.9.C (solo RESERVADA en Aprobaciones). */
export async function anularFi(fiId: number, motivo: string): Promise<MutationResult> {
  const result = await anularYReintegrarFi(fiId, {
    permitirConfirmada: false,
    motivo: (motivo || "").trim() || "Sin motivo",
  });
  return { ok: result.ok, msg: result.msg };
}

/** rechazar_pedido() — logic.py (anula FIs RESERVADA + marca pedido RECHAZADO) */
export async function rechazarPedido(pedidoId: number, motivo: string): Promise<MutationResult> {
  if (!isRimecDatabaseConfigured()) {
    return { ok: false, msg: "DATABASE_URL no configurada." };
  }

  const pool = getRimecPool();
  const { rows: fis } = await pool.query<{ id: number; nro_factura: string }>(
    `SELECT id, nro_factura FROM factura_interna WHERE pedido_id = $1 AND estado = 'RESERVADA'`,
    [pedidoId]
  );

  const fisAnuladas: string[] = [];
  const fisErrores: string[] = [];

  for (const fi of fis) {
    const res = await anularFi(fi.id, `Pedido rechazado: ${motivo}`);
    if (res.ok) fisAnuladas.push(fi.nro_factura);
    else fisErrores.push(`${fi.nro_factura}: ${res.msg}`);
  }

  try {
    await pool.query(
      `UPDATE pedido_venta_rimec SET estado = 'RECHAZADO', motivo_rechazo = $2 WHERE id = $1 AND estado = 'PENDIENTE'`,
      [pedidoId, motivo.trim()]
    );
  } catch (e) {
    return { ok: false, msg: e instanceof Error ? e.message : String(e) };
  }

  let msg = "Pedido rechazado.";
  if (fisAnuladas.length) msg += ` ${fisAnuladas.length} FI(s) anulada(s): ${fisAnuladas.join(", ")}`;
  if (fisErrores.length) msg += ` ADVERTENCIA: ${fisErrores.join("; ")}`;
  return { ok: true, msg };
}

type FiHeaderRow = {
  estado: string;
  pp_estado: string | null;
  pedido_id: number | null;
  descuento_1: number;
  descuento_2: number;
  descuento_3: number;
  descuento_4: number;
};

type DetallePrecioRow = {
  id: number;
  pares: number;
  ppd_id: number | null;
  precio_base: number | null;
  subtotal: number;
};

/**
 * Cambia lista_precio_id y recalcula desde pedido_proveedor_detalle
 * (precio_lpn / precio_lpc02 / precio_lpc03 / precio_lpc04) — cable de acero al PP.
 */
export async function actualizarListaPrecioFi(
  fiId: number,
  listaPrecioId: number,
  opts?: { allowPpEnviado?: boolean },
): Promise<MutationResult & { totalMonto?: number }> {
  if (!isRimecDatabaseConfigured()) {
    return { ok: false, msg: "DATABASE_URL no configurada." };
  }
  if (listaPrecioId < 1 || listaPrecioId > 4) {
    return { ok: false, msg: "Lista de precio inválida (1–4)." };
  }

  const pool = getRimecPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const fiRes = await client.query<FiHeaderRow>(
      `
      SELECT fi.estado,
             fi.pedido_id,
             pp.estado AS pp_estado,
             fi.descuento_1, fi.descuento_2, fi.descuento_3, fi.descuento_4
      FROM public.factura_interna fi
      LEFT JOIN public.pedido_proveedor pp ON pp.id = fi.pp_id
      WHERE fi.id = $1
      FOR UPDATE OF fi
    `,
      [fiId],
    );

    const fi = fiRes.rows[0];
    if (!fi) {
      await client.query("ROLLBACK");
      return { ok: false, msg: "FI no encontrada." };
    }

    const estado = (fi.estado || "").toUpperCase();
    if (estado !== "RESERVADA" && estado !== "CONFIRMADA") {
      await client.query("ROLLBACK");
      return { ok: false, msg: `FI en estado ${estado} — no editable.` };
    }
    if ((fi.pp_estado || "").toUpperCase() === "ENVIADO" && !opts?.allowPpEnviado) {
      await client.query("ROLLBACK");
      return { ok: false, msg: "PP enviado a compra — edición cerrada." };
    }

    const eraConfirmada = estado === "CONFIRMADA";
    if (eraConfirmada) {
      await client.query(
        `UPDATE public.factura_interna SET estado = 'RESERVADA' WHERE id = $1 AND estado = 'CONFIRMADA'`,
        [fiId],
      );
    }

    const detRes = await client.query<DetallePrecioRow>(
      `
      SELECT
        fid.id,
        fid.pares,
        fid.ppd_id,
        fid.subtotal,
        ${sqlPrecioBaseFiDetalleConFallbackPe("$2")} AS precio_base
      ${SQL_FROM_FI_DETALLE_PRECIO}
      WHERE fid.factura_id = $1
      ORDER BY fid.id
    `,
      [fiId, listaPrecioId],
    );

    if (detRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return { ok: false, msg: "FI sin líneas de detalle." };
    }

    const sinPrecio: number[] = [];

    for (const det of detRes.rows) {
      const base = det.precio_base != null ? Number(det.precio_base) : NaN;
      if (!Number.isFinite(base) || base <= 0) {
        sinPrecio.push(det.id);
        continue;
      }
      const neto = precioNetoCascada(
        base,
        Number(fi.descuento_1),
        Number(fi.descuento_2),
        Number(fi.descuento_3),
        Number(fi.descuento_4),
      );
      const subtotal = neto * Number(det.pares);

      await client.query(
        `
        UPDATE public.factura_interna_detalle
        SET precio_unit = $2, precio_neto = $3, subtotal = $4
        WHERE id = $1
      `,
        [det.id, base, neto, subtotal],
      );
    }

    if (sinPrecio.length === detRes.rows.length) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        msg: "Sin precios en listado PP para la lista seleccionada.",
      };
    }

    const { totalMonto, totalPares } = await sumFiTotalesDesdeDetalle(client, fiId);

    await client.query(
      `
      UPDATE public.factura_interna
      SET lista_precio_id = $2, total_monto = $3, total_pares = $4
      WHERE id = $1
    `,
      [fiId, listaPrecioId, totalMonto, totalPares],
    );

    await syncPedidoTotalesDesdeFis(client, fi.pedido_id);
    await syncPedidoListaSiUnicaFi(client, fi.pedido_id, listaPrecioId);

    if (eraConfirmada) {
      await client.query(
        `UPDATE public.factura_interna SET estado = 'CONFIRMADA' WHERE id = $1 AND estado = 'RESERVADA'`,
        [fiId],
      );
    }

    await client.query("COMMIT");

    let msg = `Lista ${listaPrecioLabel(listaPrecioId)} aplicada. Nuevo total FI: Gs. ${totalMonto.toLocaleString("es-PY")}`;
    if (sinPrecio.length > 0) {
      msg += ` (${sinPrecio.length} línea(s) sin precio en PP — no actualizadas)`;
    }
    if (fi.pedido_id) {
      msg += ". Pedido PVR sincronizado.";
    }
    return { ok: true, msg, totalMonto };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, msg: e instanceof Error ? e.message : String(e) };
  } finally {
    client.release();
  }
}

async function recalcularDetallePreciosDesdePp(
  client: import("pg").PoolClient,
  fiId: number,
  listaPrecioId: number,
  d1: number,
  d2: number,
  d3: number,
  d4: number,
): Promise<{ ok: true } | { ok: false; msg: string }> {
  const detRes = await client.query<DetallePrecioRow>(
    `
    SELECT
      fid.id,
      fid.pares,
      fid.ppd_id,
      fid.subtotal,
      ${sqlPrecioBaseFiDetalleConFallbackPe("$2")} AS precio_base
    ${SQL_FROM_FI_DETALLE_PRECIO}
    WHERE fid.factura_id = $1
    ORDER BY fid.id
  `,
    [fiId, listaPrecioId],
  );

  if (detRes.rows.length === 0) {
    return { ok: false, msg: "FI sin líneas de detalle." };
  }

  let actualizadas = 0;
  for (const det of detRes.rows) {
    const base = det.precio_base != null ? Number(det.precio_base) : NaN;
    if (!Number.isFinite(base) || base <= 0) continue;
    const neto = precioNetoCascada(base, d1, d2, d3, d4);
    const subtotal = neto * Number(det.pares);
    await client.query(
      `
      UPDATE public.factura_interna_detalle
      SET precio_unit = $2, precio_neto = $3, subtotal = $4
      WHERE id = $1
    `,
      [det.id, base, neto, subtotal],
    );
    actualizadas++;
  }

  if (actualizadas === 0) {
    return { ok: false, msg: "Sin precios en listado PP para recalcular." };
  }
  return { ok: true };
}

/** eliminar_item_fi() — logic.py */
export async function eliminarItemFi(fiDetalleId: number): Promise<MutationResult> {
  if (!isRimecDatabaseConfigured()) {
    return { ok: false, msg: "DATABASE_URL no configurada." };
  }

  const pool = getRimecPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const detRes = await client.query<{
      id: number;
      factura_id: number;
      ppd_id: number | null;
      pares: number;
      estado: string;
      pp_estado: string | null;
      pedido_id: number | null;
      nro_factura: string;
      item_count: string;
    }>(
      `
      SELECT
        fid.id,
        fid.factura_id,
        fid.ppd_id,
        fid.pares,
        fi.estado,
        fi.pedido_id,
        fi.nro_factura,
        pp.estado AS pp_estado,
        (SELECT COUNT(*)::text FROM public.factura_interna_detalle d WHERE d.factura_id = fi.id) AS item_count
      FROM public.factura_interna_detalle fid
      JOIN public.factura_interna fi ON fi.id = fid.factura_id
      LEFT JOIN public.pedido_proveedor pp ON pp.id = fi.pp_id
      WHERE fid.id = $1
      FOR UPDATE OF fid, fi
    `,
      [fiDetalleId],
    );

    const det = detRes.rows[0];
    if (!det) {
      await client.query("ROLLBACK");
      return { ok: false, msg: "Ítem no encontrado." };
    }

    const estado = (det.estado || "").toUpperCase();
    if (estado !== "RESERVADA" && estado !== "CONFIRMADA") {
      await client.query("ROLLBACK");
      return { ok: false, msg: `FI en estado ${estado} — no editable.` };
    }
    if ((det.pp_estado || "").toUpperCase() === "ENVIADO") {
      await client.query("ROLLBACK");
      return { ok: false, msg: "PP enviado a compra — edición cerrada." };
    }

    if (parseInt(det.item_count, 10) <= 1) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        msg: "No se puede eliminar el único ítem. Anulá la FI completa.",
      };
    }

    const lockRes = await lockFiEditable(client, det.factura_id);
    if (!lockRes.ok) {
      await client.query("ROLLBACK");
      return { ok: false, msg: lockRes.msg };
    }

    const pares = Number(det.pares) || 0;
    if (det.ppd_id && pares > 0) {
      await client.query(
        `
        UPDATE public.pedido_proveedor_detalle
        SET pares_vendidos = GREATEST(0, COALESCE(pares_vendidos, 0) - $2)
        WHERE id = $1
      `,
        [det.ppd_id, pares],
      );
    }

    await client.query(`DELETE FROM public.factura_interna_detalle WHERE id = $1`, [fiDetalleId]);

    await recalcularFiTotalesYsyncPvr(client, {
      fiId: det.factura_id,
      pedidoId: det.pedido_id,
    });
    await restoreFiEstadoTrasEdicion(client, lockRes.lock);

    await client.query("COMMIT");
    return {
      ok: true,
      msg: `Ítem eliminado. Stock revertido: ${pares} pares.`,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, msg: e instanceof Error ? e.message : String(e) };
  } finally {
    client.release();
  }
}

/** modificar_cantidad_item_fi() — logic.py */
export async function modificarCantidadItemFi(
  fiDetalleId: number,
  nuevasCajas: number,
  nuevosPares: number,
): Promise<MutationResult> {
  if (!isRimecDatabaseConfigured()) {
    return { ok: false, msg: "DATABASE_URL no configurada." };
  }
  if (nuevosPares <= 0) {
    return { ok: false, msg: "Los pares deben ser mayor a 0." };
  }

  const pool = getRimecPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const detRes = await client.query<{
      id: number;
      factura_id: number;
      ppd_id: number | null;
      pares_antiguos: number;
      precio_neto: number;
      estado: string;
      pp_estado: string | null;
      pedido_id: number | null;
    }>(
      `
      SELECT
        fid.id,
        fid.factura_id,
        fid.ppd_id,
        fid.pares AS pares_antiguos,
        fid.precio_neto,
        fi.estado,
        fi.pedido_id,
        pp.estado AS pp_estado
      FROM public.factura_interna_detalle fid
      JOIN public.factura_interna fi ON fi.id = fid.factura_id
      LEFT JOIN public.pedido_proveedor pp ON pp.id = fi.pp_id
      WHERE fid.id = $1
      FOR UPDATE OF fid, fi
    `,
      [fiDetalleId],
    );

    const det = detRes.rows[0];
    if (!det) {
      await client.query("ROLLBACK");
      return { ok: false, msg: "Ítem no encontrado." };
    }

    const estado = (det.estado || "").toUpperCase();
    if (estado !== "RESERVADA" && estado !== "CONFIRMADA") {
      await client.query("ROLLBACK");
      return { ok: false, msg: `FI en estado ${estado} — no editable.` };
    }
    if ((det.pp_estado || "").toUpperCase() === "ENVIADO") {
      await client.query("ROLLBACK");
      return { ok: false, msg: "PP enviado a compra — edición cerrada." };
    }

    const lockRes = await lockFiEditable(client, det.factura_id);
    if (!lockRes.ok) {
      await client.query("ROLLBACK");
      return { ok: false, msg: lockRes.msg };
    }

    const paresAntiguos = Number(det.pares_antiguos) || 0;
    const diferencia = nuevosPares - paresAntiguos;
    const precioNeto = Number(det.precio_neto) || 0;
    const nuevoSubtotal = precioNeto * nuevosPares;

    await client.query(
      `
      UPDATE public.factura_interna_detalle
      SET cajas = $2, pares = $3, subtotal = $4
      WHERE id = $1
    `,
      [fiDetalleId, nuevasCajas, nuevosPares, nuevoSubtotal],
    );

    if (diferencia !== 0 && det.ppd_id) {
      if (diferencia > 0) {
        await client.query(`SELECT descontar_stock_pp($1, $2)`, [det.ppd_id, diferencia]);
      } else {
        await client.query(
          `
          UPDATE public.pedido_proveedor_detalle
          SET pares_vendidos = GREATEST(0, COALESCE(pares_vendidos, 0) + $2)
          WHERE id = $1
        `,
          [det.ppd_id, diferencia],
        );
      }
    }

    await recalcularFiTotalesYsyncPvr(client, {
      fiId: det.factura_id,
      pedidoId: det.pedido_id,
    });
    await restoreFiEstadoTrasEdicion(client, lockRes.lock);

    await client.query("COMMIT");
    return {
      ok: true,
      msg: `Cantidad: ${paresAntiguos} → ${nuevosPares} pares.`,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, msg: e instanceof Error ? e.message : String(e) };
  } finally {
    client.release();
  }
}

/** cambiar_cliente_fi() — logic.py */
export async function cambiarClienteFi(
  fiId: number,
  nuevoClienteId: number,
): Promise<MutationResult & { clienteNombre?: string }> {
  if (!isRimecDatabaseConfigured()) {
    return { ok: false, msg: "DATABASE_URL no configurada." };
  }

  const pool = getRimecPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const lockRes = await lockFiEditable(client, fiId, { flipConfirmada: false });
    if (!lockRes.ok) {
      await client.query("ROLLBACK");
      return { ok: false, msg: lockRes.msg };
    }

    const cliRes = await client.query<{ descp_cliente: string }>(
      `SELECT descp_cliente FROM public.cliente_v2 WHERE id_cliente = $1 LIMIT 1`,
      [nuevoClienteId],
    );
    if (!cliRes.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false, msg: `Cliente ${nuevoClienteId} no encontrado.` };
    }

    const upd = await client.query(
      `
      UPDATE public.factura_interna
      SET cliente_id = $2
      WHERE id = $1 AND estado IN ('RESERVADA', 'CONFIRMADA')
    `,
      [fiId, nuevoClienteId],
    );
    if ((upd.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      return { ok: false, msg: "FI no actualizable." };
    }

    if (lockRes.lock.pedidoId) {
      await client.query(
        `UPDATE public.pedido_venta_rimec SET cliente_id = $2 WHERE id = $1`,
        [lockRes.lock.pedidoId, nuevoClienteId],
      );
    }

    await client.query("COMMIT");
    return {
      ok: true,
      msg: `Cliente: ${cliRes.rows[0].descp_cliente}`,
      clienteNombre: cliRes.rows[0].descp_cliente,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, msg: e instanceof Error ? e.message : String(e) };
  } finally {
    client.release();
  }
}

/** Cambia vendedor en FI y pedido web. */
export async function cambiarVendedorFi(
  fiId: number,
  nuevoVendedorId: number,
): Promise<MutationResult & { vendedorNombre?: string }> {
  if (!isRimecDatabaseConfigured()) {
    return { ok: false, msg: "DATABASE_URL no configurada." };
  }

  const pool = getRimecPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const lockRes = await lockFiEditable(client, fiId, { flipConfirmada: false });
    if (!lockRes.ok) {
      await client.query("ROLLBACK");
      return { ok: false, msg: lockRes.msg };
    }

    const vendRes = await client.query<{ descp_usuario: string }>(
      `SELECT descp_usuario FROM public.usuario_v2 WHERE id_usuario = $1 LIMIT 1`,
      [nuevoVendedorId],
    );
    if (!vendRes.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false, msg: `Usuario ${nuevoVendedorId} no encontrado.` };
    }

    await client.query(
      `
      UPDATE public.factura_interna
      SET vendedor_id = $2
      WHERE id = $1 AND estado IN ('RESERVADA', 'CONFIRMADA')
    `,
      [fiId, nuevoVendedorId],
    );

    if (lockRes.lock.pedidoId) {
      await client.query(
        `UPDATE public.pedido_venta_rimec SET vendedor_id = $2 WHERE id = $1`,
        [lockRes.lock.pedidoId, nuevoVendedorId],
      );
    }

    await client.query("COMMIT");
    return {
      ok: true,
      msg: `Vendedor: ${vendRes.rows[0].descp_usuario}`,
      vendedorNombre: vendRes.rows[0].descp_usuario,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, msg: e instanceof Error ? e.message : String(e) };
  } finally {
    client.release();
  }
}

export type EncabezadoFiInput = {
  plazoId: number;
  descuento_1: number;
  descuento_2: number;
  descuento_3: number;
  descuento_4: number;
};

/** Plazo + descuentos — precios desde PPD. */
export async function actualizarEncabezadoFi(
  fiId: number,
  input: EncabezadoFiInput,
): Promise<MutationResult & { totalMonto?: number }> {
  if (!isRimecDatabaseConfigured()) {
    return { ok: false, msg: "DATABASE_URL no configurada." };
  }

  const pool = getRimecPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const lockRes = await lockFiEditable(client, fiId);
    if (!lockRes.ok) {
      await client.query("ROLLBACK");
      return { ok: false, msg: lockRes.msg };
    }
    const lock = lockRes.lock;

    const plazoOk = await client.query(
      `SELECT 1 FROM public.plazo_v2 WHERE id_plazo = $1 LIMIT 1`,
      [input.plazoId],
    );
    if (!plazoOk.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false, msg: "Plazo no encontrado." };
    }

    const recalc = await recalcularDetallePreciosDesdePp(
      client,
      fiId,
      lock.listaPrecioId,
      input.descuento_1,
      input.descuento_2,
      input.descuento_3,
      input.descuento_4,
    );
    if (!recalc.ok) {
      await client.query("ROLLBACK");
      return { ok: false, msg: recalc.msg };
    }

    const { totalMonto, totalPares } = await sumFiTotalesDesdeDetalle(client, fiId);

    await client.query(
      `
      UPDATE public.factura_interna
      SET
        plazo_id = $2,
        descuento_1 = $3,
        descuento_2 = $4,
        descuento_3 = $5,
        descuento_4 = $6,
        total_monto = $7,
        total_pares = $8
      WHERE id = $1
    `,
      [
        fiId,
        input.plazoId,
        input.descuento_1,
        input.descuento_2,
        input.descuento_3,
        input.descuento_4,
        totalMonto,
        totalPares,
      ],
    );

    await syncPedidoTotalesDesdeFis(client, lock.pedidoId);
    await syncPedidoEncabezadoDesdeFi(client, lock.pedidoId, {
      lista_precio_id: lock.listaPrecioId,
      plazo_id: input.plazoId,
      descuento_1: input.descuento_1,
      descuento_2: input.descuento_2,
      descuento_3: input.descuento_3,
      descuento_4: input.descuento_4,
    });

    // Plazo siempre al PVR (aunque haya varias FI): el sync de cabecera solo corre si n=1.
    if (lock.pedidoId != null) {
      await client.query(
        `UPDATE public.pedido_venta_rimec
         SET plazo_id = $2
         WHERE id = $1 AND UPPER(TRIM(estado)) = 'PENDIENTE'`,
        [lock.pedidoId, input.plazoId],
      );
    }

    await restoreFiEstadoTrasEdicion(client, lock);

    await client.query("COMMIT");
    return {
      ok: true,
      msg: `Encabezado actualizado. Total: Gs. ${totalMonto.toLocaleString("es-PY")}`,
      totalMonto,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, msg: e instanceof Error ? e.message : String(e) };
  } finally {
    client.release();
  }
}

/**
 * Plazo a nivel pedido — aplica a todas las FI RESERVADA + cabecera PVR.
 * Evita depender de expandir cada célula cuando el listado falla/timeout.
 */
export async function actualizarPlazoPedido(
  pedidoId: number,
  plazoId: number,
): Promise<MutationResult & { fisActualizadas?: number }> {
  if (!isRimecDatabaseConfigured()) {
    return { ok: false, msg: "DATABASE_URL no configurada." };
  }
  if (!Number.isFinite(pedidoId) || pedidoId <= 0) {
    return { ok: false, msg: "Pedido inválido." };
  }
  if (!Number.isFinite(plazoId) || plazoId <= 0) {
    return { ok: false, msg: "Plazo inválido." };
  }

  const pool = getRimecPool();
  const { rows: fiRows } = await pool.query<{
    id: number;
    descuento_1: number;
    descuento_2: number;
    descuento_3: number;
    descuento_4: number;
    pp_estado: string | null;
  }>(
    `
    SELECT fi.id, fi.descuento_1, fi.descuento_2, fi.descuento_3, fi.descuento_4,
           pp.estado AS pp_estado
    FROM public.factura_interna fi
    LEFT JOIN public.pedido_proveedor pp ON pp.id = fi.pp_id
    WHERE fi.pedido_id = $1
      AND UPPER(TRIM(fi.estado)) = 'RESERVADA'
    ORDER BY fi.id
    `,
    [pedidoId],
  );

  if (!fiRows.length) {
    // Solo cabecera PVR si aún no hay FI reservada
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const plazoOk = await client.query(
        `SELECT 1 FROM public.plazo_v2 WHERE id_plazo = $1 LIMIT 1`,
        [plazoId],
      );
      if (!plazoOk.rows[0]) {
        await client.query("ROLLBACK");
        return { ok: false, msg: "Plazo no encontrado." };
      }
      await client.query(
        `UPDATE public.pedido_venta_rimec SET plazo_id = $2 WHERE id = $1 AND estado = 'PENDIENTE'`,
        [pedidoId, plazoId],
      );
      await client.query("COMMIT");
      return { ok: true, msg: "Plazo del pedido actualizado (sin FI pendientes).", fisActualizadas: 0 };
    } catch (e) {
      await client.query("ROLLBACK");
      return { ok: false, msg: e instanceof Error ? e.message : String(e) };
    } finally {
      client.release();
    }
  }

  let okCount = 0;
  const errores: string[] = [];
  for (const fi of fiRows) {
    if ((fi.pp_estado || "").toUpperCase() === "ENVIADO") {
      errores.push(`FI ${fi.id}: PP enviado`);
      continue;
    }
    const res = await actualizarEncabezadoFi(fi.id, {
      plazoId,
      descuento_1: Number(fi.descuento_1) || 0,
      descuento_2: Number(fi.descuento_2) || 0,
      descuento_3: Number(fi.descuento_3) || 0,
      descuento_4: Number(fi.descuento_4) || 0,
    });
    if (res.ok) okCount += 1;
    else errores.push(`FI ${fi.id}: ${res.msg}`);
  }

  if (okCount === 0) {
    return {
      ok: false,
      msg: errores[0] || "No se pudo actualizar el plazo en ninguna FI.",
      fisActualizadas: 0,
    };
  }

  return {
    ok: true,
    msg:
      errores.length === 0
        ? `Plazo aplicado a ${okCount} FI pendiente(s).`
        : `Plazo en ${okCount} FI · avisos: ${errores.join("; ")}`,
    fisActualizadas: okCount,
  };
}

type ResyncLineRow = {
  id: number;
  ppd_id: number | null;
  pares: number;
  precio_antes: number;
  precio_nuevo: number | null;
  linea: string | null;
  referencia: string | null;
  evento_id: number | null;
};

export type ResyncFiStats = {
  skus_total: number;
  skus_ok: number;
  skus_sin_match: number;
  skus_sin_cambio_precio: number;
  skus_cambiados: number;
  sin_match: string[];
  sin_cambio_precio: string[];
  monto_antes: number;
  monto_despues: number;
  delta_monto: number;
  evento_id: number | null;
  tier: number;
  todos_skus_ok: boolean;
  hubo_cambio_monto: boolean;
};

/** Rescate: FI + PPD desde listado ICP (incluye CONFIRMADA / PPD vendido). */
export async function resincronizarFiDesdeListadoPp(
  fiId: number,
  opts?: {
    usarRedondeoComercial?: boolean;
    allowPpEnviado?: boolean;
    /** Botón impositor — tier impuesto (ignora biblioteca/caso BCL). */
    listaPrecioIdOverride?: number;
    /** Listado motor FI — solo precio_lista del evento; prohibido snapshot PPD. */
    forzarSoloPrecioLista?: boolean;
    /** Evento motor impuesto (param SQL). */
    precioEventoIdOverride?: number;
  },
): Promise<MutationResult & { totalMonto?: number; lineas?: string[]; stats?: ResyncFiStats }> {
  if (!isRimecDatabaseConfigured()) {
    return { ok: false, msg: "DATABASE_URL no configurada." };
  }

  const comercial = opts?.usarRedondeoComercial !== false;
  const pool = getRimecPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const lockRes = await lockFiEditable(client, fiId, {
      flipConfirmada: false,
      allowPpEnviado: opts?.allowPpEnviado,
    });
    if (!lockRes.ok) {
      await client.query("ROLLBACK");
      return { ok: false, msg: lockRes.msg };
    }
    const lock = lockRes.lock;
    let tier = lock.listaPrecioId;
    if (opts?.listaPrecioIdOverride != null && esListadoPrecioValido(opts.listaPrecioIdOverride)) {
      tier = opts.listaPrecioIdOverride;
      await client.query(
        `UPDATE public.factura_interna SET lista_precio_id = $2 WHERE id = $1`,
        [fiId, tier],
      );
    }
    if (tier < 1 || tier > 4) {
      await client.query("ROLLBACK");
      return { ok: false, msg: "Lista de precio FI inválida (1–4)." };
    }

    const precioExpr = opts?.forzarSoloPrecioLista
      ? (comercial
          ? `COALESCE(${sqlPrecioComercialDesdePl("$2")}, ${sqlPrecioBaseFiDetalleSoloEvento("$2")})`
          : sqlPrecioBaseFiDetalleSoloEvento("$2"))
      : comercial
        ? `COALESCE(${sqlPrecioComercialDesdePl("$2")}, ${sqlPrecioBaseFiDetalle("$2")})`
        : sqlPrecioBaseFiDetalle("$2");

    const fromPrecio =
      opts?.forzarSoloPrecioLista && opts.precioEventoIdOverride != null
        ? sqlFromFiDetallePrecioEventoOverride("$3")
        : SQL_FROM_FI_DETALLE_PRECIO;

    const detParams =
      opts?.forzarSoloPrecioLista && opts.precioEventoIdOverride != null
        ? [fiId, tier, opts.precioEventoIdOverride]
        : [fiId, tier];

    const detRes = await client.query<ResyncLineRow>(
      `
      SELECT
        fid.id,
        fid.ppd_id,
        fid.pares,
        fid.precio_neto::float AS precio_antes,
        ${precioExpr}::float AS precio_nuevo,
        ppd.linea,
        ppd.referencia,
        ic_ev.precio_evento_id::int AS evento_id
      ${fromPrecio}
      WHERE fid.factura_id = $1
      ORDER BY fid.id
    `,
      detParams,
    );

    if (detRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return { ok: false, msg: "FI sin líneas." };
    }

    const montoAntesRes = await client.query<{ s: string }>(
      `SELECT COALESCE(total_monto, 0)::text AS s FROM public.factura_interna WHERE id = $1`,
      [fiId],
    );
    const montoAntes = Number(montoAntesRes.rows[0]?.s ?? 0);

    const lineasLog: string[] = [];
    let actualizadas = 0;
    const sinMatch: string[] = [];
    const sinCambioPrecio: string[] = [];
    const tierCol =
      tier === 2 ? "precio_lpc02" : tier === 3 ? "precio_lpc03" : tier === 4 ? "precio_lpc04" : "precio_lpn";

    let lineasProcesadas = 0;
    for (const det of detRes.rows) {
      const rawPrecio = det.precio_nuevo != null ? Number(det.precio_nuevo) : NaN;
      const hadMatch = Number.isFinite(rawPrecio) && rawPrecio > 0;
      let base: number;

      if (hadMatch) {
        base = rawPrecio;
      } else if (opts?.forzarSoloPrecioLista) {
        base = 0;
        sinMatch.push(`${det.linea ?? "?"}/${det.referencia ?? "?"}`);
      } else {
        sinMatch.push(`${det.linea ?? "?"}/${det.referencia ?? "?"}`);
        continue;
      }

      const neto =
        base === 0
          ? 0
          : precioNetoCascada(
              base,
              lock.descuento_1,
              lock.descuento_2,
              lock.descuento_3,
              lock.descuento_4,
            );
      const subtotal = neto * Number(det.pares);

      await client.query(
        `UPDATE public.factura_interna_detalle SET precio_unit = $2, precio_neto = $3, subtotal = $4 WHERE id = $1`,
        [det.id, base, neto, subtotal],
      );

      const netoAntes = Number(det.precio_antes);
      if (Number.isFinite(netoAntes) && Math.round(neto) === Math.round(netoAntes)) {
        sinCambioPrecio.push(`${det.linea ?? "?"}/${det.referencia ?? "?"}`);
      }

      const eventoPpd = opts?.precioEventoIdOverride ?? det.evento_id;
      if (det.ppd_id && eventoPpd) {
        await client.query(
          `
          UPDATE public.pedido_proveedor_detalle
          SET listado_precio_id = $2, ${tierCol} = $3, precio_vinculado_en = NOW()
          WHERE id = $1
        `,
          [det.ppd_id, eventoPpd, base],
        );
      }

      lineasLog.push(
        hadMatch
          ? `L${det.linea}/R${det.referencia}: ${Number(det.precio_antes).toLocaleString("es-PY")} → ${neto.toLocaleString("es-PY")}`
          : `L${det.linea}/R${det.referencia}: ${Number(det.precio_antes).toLocaleString("es-PY")} → 0 (sin match listado)`,
      );
      if (hadMatch) actualizadas++;
      lineasProcesadas++;
    }

    if (lineasProcesadas === 0) {
      await client.query("ROLLBACK");
      const evLabel = opts?.precioEventoIdOverride ?? detRes.rows[0]?.evento_id ?? "?";
      return {
        ok: false,
        msg: `Sin líneas procesables en listado #${evLabel}.`,
      };
    }

    const { totalMonto, totalPares } = await sumFiTotalesDesdeDetalle(client, fiId);
    await client.query(
      `UPDATE public.factura_interna SET total_monto = $2, total_pares = $3 WHERE id = $1`,
      [fiId, totalMonto, totalPares],
    );

    // Si la cabecera quedó sin caso (bug Admin IC / motor), rellenar desde listado PP.
    const cabRes = await client.query<{
      pp_id: number | null;
      caso: string | null;
    }>(
      `SELECT pp_id, caso FROM public.factura_interna WHERE id = $1`,
      [fiId],
    );
    const cab = cabRes.rows[0];
    let casoRellenado = false;
    if (cab?.pp_id && (!cab.caso || !String(cab.caso).trim())) {
      const eventoId = detRes.rows.find((r) => r.evento_id)?.evento_id ?? null;
      const ppdIds = detRes.rows
        .map((r) => Number(r.ppd_id))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (eventoId && ppdIds.length) {
        const casoCab = await resolveCasoDominanteDesdePpd(client, cab.pp_id, eventoId, ppdIds);
        if (casoCab.caso) {
          await client.query(
            `UPDATE public.factura_interna SET caso = $2, caso_id = COALESCE($3, caso_id) WHERE id = $1`,
            [fiId, casoCab.caso, casoCab.caso_id],
          );
          casoRellenado = true;
        }
      }
    }

    await syncPedidoTotalesDesdeFis(client, lock.pedidoId);
    await syncPedidoListaSiUnicaFi(client, lock.pedidoId, tier);
    await restoreFiEstadoTrasEdicion(client, lock);
    await client.query("COMMIT");

    let msg = `Resincronizado listado #${detRes.rows[0]?.evento_id ?? "?"}. ${actualizadas} línea(s). Total: Gs. ${totalMonto.toLocaleString("es-PY")}`;
    if (comercial) msg += " (redondeo comercial).";
    if (casoRellenado) msg += " Caso comercial rellenado desde PP.";
    if (sinMatch.length) {
      msg += opts?.forzarSoloPrecioLista
        ? ` ${sinMatch.length} SKU(s) sin match → precio 0.`
        : ` Sin match: ${sinMatch.join(", ")}.`;
    }

    const skusConPrecio = actualizadas;
    const stats: ResyncFiStats = {
      skus_total: detRes.rows.length,
      skus_ok: skusConPrecio,
      skus_sin_match: sinMatch.length,
      skus_sin_cambio_precio: sinCambioPrecio.length,
      skus_cambiados: lineasProcesadas - sinCambioPrecio.length,
      sin_match: sinMatch,
      sin_cambio_precio: sinCambioPrecio,
      monto_antes: montoAntes,
      monto_despues: totalMonto,
      delta_monto: totalMonto - montoAntes,
      evento_id: opts?.precioEventoIdOverride ?? detRes.rows[0]?.evento_id ?? null,
      tier,
      todos_skus_ok: sinMatch.length === 0,
      hubo_cambio_monto: totalMonto !== montoAntes,
    };

    return { ok: true, msg, totalMonto, lineas: lineasLog, stats };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, msg: e instanceof Error ? e.message : String(e) };
  } finally {
    client.release();
  }
}

/** MIG-175 — observación + fecha entrega PE (Nivel Dios · Aprobaciones). */
export async function actualizarLogisticaFi(
  fiId: number,
  input: { observacion: string | null; fecha_entrega_cliente: string | null },
): Promise<MutationResult> {
  if (!isRimecDatabaseConfigured()) {
    return { ok: false, msg: "DATABASE_URL no configurada." };
  }
  const obs = input.observacion?.trim().slice(0, 2000) || null;
  const fechaRaw = input.fecha_entrega_cliente?.trim().slice(0, 10) || null;
  const fecha = fechaRaw && /^\d{4}-\d{2}-\d{2}$/.test(fechaRaw) ? fechaRaw : null;

  const pool = getRimecPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ pedido_id: number | null }>(
      `SELECT pedido_id FROM factura_interna WHERE id = $1 FOR UPDATE`,
      [fiId],
    );
    if (!rows.length) {
      await client.query("ROLLBACK");
      return { ok: false, msg: "FI no encontrada." };
    }
    const pedidoId = rows[0].pedido_id;

    await client.query(
      `UPDATE factura_interna
       SET observacion = $2,
           fecha_entrega_cliente = $3::date
       WHERE id = $1`,
      [fiId, obs, fecha],
    );

    if (pedidoId != null) {
      await client.query(
        `UPDATE pedido_venta_rimec
         SET observacion = $2,
             fecha_entrega_cliente = $3::date
         WHERE id = $1`,
        [pedidoId, obs, fecha],
      );
    }

    await client.query(
      `UPDATE logistica_pendiente_confirmacion
       SET observacion = COALESCE($2, observacion),
           fecha_entrega_vendedor = COALESCE($3::date, fecha_entrega_vendedor)
       WHERE factura_interna_id = $1`,
      [fiId, obs, fecha],
    );

    await client.query("COMMIT");
    return { ok: true, msg: "Observación logística actualizada." };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, msg: e instanceof Error ? e.message : String(e) };
  } finally {
    client.release();
  }
}
