import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { anularYReintegrarFi } from "@/lib/facturacion/anular-reintegrar-fi";
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
  SQL_FROM_FI_DETALLE_PRECIO,
  sqlPrecioComercialDesdePl,
} from "./fi-precio-evento-lookup";

export type MutationResult = { ok: boolean; msg: string };

/** confirmar_fi() — logic.py (sin email/PDF en Report v1) */
export async function confirmarFi(fiId: number): Promise<MutationResult> {
  if (!isRimecDatabaseConfigured()) {
    return { ok: false, msg: "DATABASE_URL no configurada." };
  }

  const pool = getRimecPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const pedidoRes = await client.query<{ pedido_id: number | null }>(
      `SELECT pedido_id FROM public.factura_interna WHERE id = $1 LIMIT 1`,
      [fiId]
    );
    const pedidoId = pedidoRes.rows[0]?.pedido_id ?? null;

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
                SUM(CASE WHEN estado = 'CONFIRMADA' THEN 1 ELSE 0 END)::text AS confirmadas
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

    let msg = "FI confirmada exitosamente.";
    if (pedidoCompleto) {
      msg += " El pedido ha sido CONFIRMADO.";
    }
    return { ok: true, msg };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, msg: e instanceof Error ? e.message : String(e) };
  } finally {
    client.release();
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
    if ((fi.pp_estado || "").toUpperCase() === "ENVIADO") {
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
        ${sqlPrecioBaseFiDetalle("$2")} AS precio_base
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
      ${sqlPrecioBaseFiDetalle("$2")} AS precio_base
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

/** Rescate: FI + PPD desde listado ICP (incluye CONFIRMADA / PPD vendido). */
export async function resincronizarFiDesdeListadoPp(
  fiId: number,
  opts?: { usarRedondeoComercial?: boolean },
): Promise<MutationResult & { totalMonto?: number; lineas?: string[] }> {
  if (!isRimecDatabaseConfigured()) {
    return { ok: false, msg: "DATABASE_URL no configurada." };
  }

  const comercial = opts?.usarRedondeoComercial !== false;
  const pool = getRimecPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const lockRes = await lockFiEditable(client, fiId, { flipConfirmada: false });
    if (!lockRes.ok) {
      await client.query("ROLLBACK");
      return { ok: false, msg: lockRes.msg };
    }
    const lock = lockRes.lock;
    const tier = lock.listaPrecioId;
    if (tier < 1 || tier > 4) {
      await client.query("ROLLBACK");
      return { ok: false, msg: "Lista de precio FI inválida (1–4)." };
    }

    const precioExpr = comercial
      ? `COALESCE(${sqlPrecioComercialDesdePl("$2")}, ${sqlPrecioBaseFiDetalle("$2")})`
      : sqlPrecioBaseFiDetalle("$2");

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
        icp.precio_evento_id::int AS evento_id
      ${SQL_FROM_FI_DETALLE_PRECIO}
      WHERE fid.factura_id = $1
      ORDER BY fid.id
    `,
      [fiId, tier],
    );

    if (detRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return { ok: false, msg: "FI sin líneas." };
    }

    const lineasLog: string[] = [];
    let actualizadas = 0;
    const sinMatch: string[] = [];
    const tierCol =
      tier === 2 ? "precio_lpc02" : tier === 3 ? "precio_lpc03" : tier === 4 ? "precio_lpc04" : "precio_lpn";

    for (const det of detRes.rows) {
      const base = det.precio_nuevo != null ? Number(det.precio_nuevo) : NaN;
      if (!Number.isFinite(base) || base <= 0) {
        sinMatch.push(`${det.linea ?? "?"}/${det.referencia ?? "?"}`);
        continue;
      }

      const neto = precioNetoCascada(
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

      if (det.ppd_id && det.evento_id) {
        await client.query(
          `
          UPDATE public.pedido_proveedor_detalle
          SET listado_precio_id = $2, ${tierCol} = $3, precio_vinculado_en = NOW()
          WHERE id = $1
        `,
          [det.ppd_id, det.evento_id, base],
        );
      }

      lineasLog.push(
        `L${det.linea}/R${det.referencia}: ${Number(det.precio_antes).toLocaleString("es-PY")} → ${neto.toLocaleString("es-PY")}`,
      );
      actualizadas++;
    }

    if (actualizadas === 0) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        msg: `Sin match en listado #${detRes.rows[0]?.evento_id ?? "?"} (${sinMatch.join(", ")})`,
      };
    }

    const { totalMonto, totalPares } = await sumFiTotalesDesdeDetalle(client, fiId);
    await client.query(
      `UPDATE public.factura_interna SET total_monto = $2, total_pares = $3 WHERE id = $1`,
      [fiId, totalMonto, totalPares],
    );
    await syncPedidoTotalesDesdeFis(client, lock.pedidoId);
    await syncPedidoListaSiUnicaFi(client, lock.pedidoId, tier);
    await restoreFiEstadoTrasEdicion(client, lock);
    await client.query("COMMIT");

    let msg = `Resincronizado listado #${detRes.rows[0]?.evento_id ?? "?"}. ${actualizadas} línea(s). Total: Gs. ${totalMonto.toLocaleString("es-PY")}`;
    if (comercial) msg += " (redondeo comercial).";
    if (sinMatch.length) msg += ` Sin match: ${sinMatch.join(", ")}.`;

    return { ok: true, msg, totalMonto, lineas: lineasLog };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, msg: e instanceof Error ? e.message : String(e) };
  } finally {
    client.release();
  }
}
