import type { Pool } from "pg";
import type { ListadoMotorFiReport } from "@/lib/pedido-proveedor/listado-motor-fi-types";
import { actualizarEncabezadoFi, actualizarListaPrecioFi, resincronizarFiDesdeListadoPp } from "@/app/aprobaciones/lib/aprobaciones-mutations";
import { esListadoPrecioValido } from "@/lib/intencion-compra/listado-precio-tiers";
import {
  FACTURA_CARLOS_MAX_LEN,
  FACTURA_CARLOS_MIN_LEN,
  normalizeFacturaCarlosDigits,
  resolveFacturaCarlosImport,
} from "@/lib/logistica-ok/factura-real";
import { syncLogisticaPpIfBandera } from "@/lib/logistica-ok/sync-pp";
import { syncLogisticaMontosDesdeFi } from "@/lib/logistica-ok/sync-fi-montos";
import {
  resolveIcIdPorFiNotas,
  syncIcDesdeFiPatch,
} from "@/lib/pedido-proveedor/trinidad-ic-pf-fi-sync";

/** Bootstrap FI vacíos desde IC emparejada por fi.notas. */
export async function syncFiEncabezadoDesdeIc(pool: Pool, ppId: number): Promise<void> {
  await pool.query(
    `UPDATE factura_interna fi
     SET plazo_id = ic.id_plazo
     FROM intencion_compra ic
     JOIN intencion_compra_pedido icp ON icp.intencion_compra_id = ic.id AND icp.pedido_proveedor_id = $1
     WHERE fi.pp_id = $1
       AND TRIM(ic.numero_registro) = TRIM(COALESCE(fi.notas, ''))
       AND fi.plazo_id IS NULL
       AND ic.id_plazo IS NOT NULL`,
    [ppId],
  );
  await pool.query(
    `UPDATE factura_interna fi
     SET lista_precio_id = ic.listado_precio_id
     FROM intencion_compra ic
     JOIN intencion_compra_pedido icp ON icp.intencion_compra_id = ic.id AND icp.pedido_proveedor_id = $1
     WHERE fi.pp_id = $1
       AND TRIM(ic.numero_registro) = TRIM(COALESCE(fi.notas, ''))
       AND ic.listado_precio_id IS NOT NULL
       AND (fi.lista_precio_id IS NULL OR fi.lista_precio_id = 1)
       AND ic.listado_precio_id <> COALESCE(fi.lista_precio_id, 0)`,
    [ppId],
  );
}

export async function actualizarListaPrecioFiDesdePp(
  pool: Pool,
  ppId: number,
  fiId: number,
  listaPrecioId: number,
): Promise<{ ok: true; totalMonto?: number } | { ok: false; error: string }> {
  if (!esListadoPrecioValido(listaPrecioId)) {
    return { ok: false, error: "Política LP inválida (1–4)." };
  }

  const link = await pool.query<{ id: string }>(
    `SELECT fi.id FROM factura_interna fi WHERE fi.id = $1 AND fi.pp_id = $2`,
    [fiId, ppId],
  );
  if (!link.rowCount) {
    return { ok: false, error: "FI no pertenece a este PP." };
  }

  const result = await actualizarListaPrecioFi(fiId, listaPrecioId);
  if (!result.ok) {
    return { ok: false, error: result.msg };
  }

  await syncIcDesdeFiPatch(pool, ppId, fiId, { listado_precio_id: listaPrecioId });

  return { ok: true, totalMonto: result.totalMonto };
}

/** Impone evento motor (#27, #28…) por FI · recalc L+R+material · sync Logística OK. */
export async function actualizarListadoMotorFiDesdePp(
  pool: Pool,
  ppId: number,
  fiId: number,
  eventoId: number,
): Promise<{ ok: true; report: ListadoMotorFiReport } | { ok: false; error: string }> {
  const t0 = Date.now();
  if (!Number.isFinite(eventoId) || eventoId <= 0) {
    return { ok: false, error: "Evento motor inválido." };
  }

  const ev = await pool.query<{ id: string }>(
    `SELECT id::text FROM precio_evento WHERE id = $1`,
    [eventoId],
  );
  if (!ev.rowCount) {
    return { ok: false, error: `Evento motor #${eventoId} no existe.` };
  }

  const fiRes = await pool.query<{ estado: string; cliente_id: string | null; nro_factura: string }>(
    `SELECT estado, cliente_id::text, nro_factura FROM factura_interna WHERE id = $1 AND pp_id = $2`,
    [fiId, ppId],
  );
  const fi = fiRes.rows[0];
  if (!fi) {
    return { ok: false, error: "FI no pertenece a este PP." };
  }

  const estado = (fi.estado || "").toUpperCase();
  if (estado !== "RESERVADA" && estado !== "CONFIRMADA") {
    return { ok: false, error: `FI ${estado} — no recalculable.` };
  }
  if (fi.cliente_id == null) {
    return { ok: false, error: "FI sin cliente SHOP — no hay IC para vincular listado." };
  }

  const icIdEmparejada = await resolveIcIdPorFiNotas(pool, ppId, fiId);
  const evAntesRes = icIdEmparejada
    ? await pool.query<{ evento_id: string | null }>(
        `SELECT precio_evento_id::text AS evento_id FROM intencion_compra WHERE id = $1`,
        [icIdEmparejada],
      )
    : { rows: [] as { evento_id: string | null }[] };
  const eventoIdAntes =
    evAntesRes.rows[0]?.evento_id != null ? Number(evAntesRes.rows[0].evento_id) : null;

  const updIc = await syncIcDesdeFiPatch(pool, ppId, fiId, { precio_evento_id: eventoId });
  if (!updIc) {
    return { ok: false, error: "Sin IC emparejada (fi.notas) — no se puede imponer listado motor." };
  }

  const resync = await resincronizarFiDesdeListadoPp(fiId, {
    usarRedondeoComercial: true,
    allowPpEnviado: true,
    forzarSoloPrecioLista: true,
    precioEventoIdOverride: eventoId,
  });
  if (!resync.ok) {
    if (icIdEmparejada) {
      await syncIcDesdeFiPatch(pool, ppId, fiId, { precio_evento_id: eventoIdAntes });
    }
    return { ok: false, error: resync.msg };
  }
  if (!resync.stats) {
    return { ok: false, error: "Resync sin estadísticas — reintentar." };
  }

  const logSync = await syncLogisticaMontosDesdeFi(pool, fiId);
  try {
    await syncLogisticaPpIfBandera(pool, ppId);
  } catch {
    /* bandera/MIG puede faltar en local */
  }

  return {
    ok: true,
    report: {
      ...resync.stats,
      evento_id: eventoId,
      evento_id_antes: eventoIdAntes,
      logistica_sync: logSync.updated,
      ms_server: Date.now() - t0,
      nro_factura: fi.nro_factura,
    },
  };
}

export async function actualizarVendedorFiDesdePp(
  pool: Pool,
  ppId: number,
  fiId: number,
  vendedorId: number,
): Promise<{ ok: true; vendedor: string } | { ok: false; error: string }> {
  if (!Number.isFinite(vendedorId) || vendedorId <= 0) {
    return { ok: false, error: "Vendedor inválido." };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ppRes = await client.query<{ estado: string }>(
      `SELECT estado FROM pedido_proveedor WHERE id = $1 FOR UPDATE`,
      [ppId],
    );
    if (!ppRes.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false, error: "PP no encontrado." };
    }
    if (ppRes.rows[0].estado === "ENVIADO") {
      await client.query("ROLLBACK");
      return { ok: false, error: "PP ENVIADO — FI en solo lectura." };
    }

    const vendRes = await client.query<{ descp_vendedor: string }>(
      `SELECT descp_vendedor FROM vendedor_v2 WHERE id_vendedor = $1`,
      [vendedorId],
    );
    if (!vendRes.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Vendedor no existe en vendedor_v2." };
    }

    const fiRes = await client.query<{ cliente_id: number | null; estado: string }>(
      `SELECT cliente_id, estado FROM factura_interna WHERE id = $1 AND pp_id = $2 FOR UPDATE`,
      [fiId, ppId],
    );
    if (!fiRes.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false, error: "FI no pertenece a este PP." };
    }
    if (!["RESERVADA", "CONFIRMADA"].includes(fiRes.rows[0].estado)) {
      await client.query("ROLLBACK");
      return { ok: false, error: "FI no editable en este estado." };
    }

    await client.query(`UPDATE factura_interna SET vendedor_id = $2 WHERE id = $1`, [fiId, vendedorId]);

    const icLink = await client.query<{ id: number }>(
      `SELECT ic.id
       FROM factura_interna fi
       JOIN intencion_compra ic ON TRIM(ic.numero_registro) = TRIM(COALESCE(fi.notas, ''))
       JOIN intencion_compra_pedido icp
         ON icp.intencion_compra_id = ic.id AND icp.pedido_proveedor_id = fi.pp_id
       WHERE fi.id = $1 AND fi.pp_id = $2
         AND TRIM(COALESCE(fi.notas, '')) <> ''
       LIMIT 1`,
      [fiId, ppId],
    );
    if (icLink.rows[0]) {
      await client.query(`UPDATE intencion_compra SET id_vendedor = $2 WHERE id = $1`, [
        icLink.rows[0].id,
        vendedorId,
      ]);
    }

    await client.query(
      `UPDATE logistica_pendiente_confirmacion SET id_vendedor = $2, updated_at = now()
       WHERE factura_interna_id = $1 AND estado = 'PENDIENTE'`,
      [fiId, vendedorId],
    );

    await client.query("COMMIT");
    return { ok: true, vendedor: vendRes.rows[0].descp_vendedor };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, error: e instanceof Error ? e.message : "Error al cambiar vendedor" };
  } finally {
    client.release();
  }
}

export type EncabezadoFiPpInput = {
  plazoId: number;
  descuento_1: number;
  descuento_2: number;
  descuento_3: number;
  descuento_4: number;
};

/** Plazo + descuentos FI desde PP — recalcula líneas + sincroniza IC vinculada. */
export async function actualizarEncabezadoFiDesdePp(
  pool: Pool,
  ppId: number,
  fiId: number,
  input: EncabezadoFiPpInput,
): Promise<{ ok: true; totalMonto: number } | { ok: false; error: string }> {
  const link = await pool.query<{ cliente_id: number | null }>(
    `SELECT cliente_id FROM factura_interna WHERE id = $1 AND pp_id = $2`,
    [fiId, ppId],
  );
  if (!link.rows[0]) {
    return { ok: false, error: "FI no pertenece a este PP." };
  }

  const result = await actualizarEncabezadoFi(fiId, input);
  if (!result.ok) {
    return { ok: false, error: result.msg };
  }

  await syncIcDesdeFiPatch(pool, ppId, fiId, {
    id_plazo: input.plazoId,
    descuento_1: input.descuento_1,
    descuento_2: input.descuento_2,
    descuento_3: input.descuento_3,
    descuento_4: input.descuento_4,
  });

  return { ok: true, totalMonto: result.totalMonto ?? 0 };
}

export type FacturaCarlosFiInput = {
  facturaCarlosRaw: string;
};

function pgUniqueViolation(msg: string): string | null {
  if (!msg.includes("unique") && !msg.includes("duplicate")) return null;
  if (msg.includes("uq_fi_pp_factura_carlos")) {
    return "Ese número Carlos ya está asignado a otra FI de este PP.";
  }
  if (msg.includes("uq_fi_factura_carlos_global")) {
    return "Ese número Carlos ya existe en otra FI del holding.";
  }
  return "Número Carlos duplicado.";
}

/** Asignación manual Factura Carlos (CP + PROGRAMADO) — sync Logística si PP PUBLICADO. */
export async function actualizarFacturaCarlosFiDesdePp(
  pool: Pool,
  ppId: number,
  fiId: number,
  input: FacturaCarlosFiInput,
): Promise<
  | { ok: true; factura_carlos: string | null; pv_global: number | null }
  | { ok: false; error: string }
> {
  const raw = String(input.facturaCarlosRaw ?? "").trim();
  let facturaCarlos: string | null = null;
  let pvGlobal: number | null = null;

  if (raw) {
    const normalized = normalizeFacturaCarlosDigits(raw);
    if (!normalized) {
      return {
        ok: false,
        error: `Factura Carlos inválida — use ${FACTURA_CARLOS_MIN_LEN}–${FACTURA_CARLOS_MAX_LEN} dígitos.`,
      };
    }
    const resolved = resolveFacturaCarlosImport(normalized);
    if (!resolved.factura_carlos) {
      return { ok: false, error: "Factura Carlos inválida." };
    }
    facturaCarlos = resolved.factura_carlos;
    pvGlobal = resolved.pv_global;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ppRes = await client.query<{ estado: string; logistica_on: boolean }>(
      `SELECT estado,
              COALESCE(logistica_bandera_activa, false) AS logistica_on
       FROM pedido_proveedor WHERE id = $1 FOR UPDATE`,
      [ppId],
    );
    if (!ppRes.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false, error: "PP no encontrado." };
    }
    if (ppRes.rows[0].estado === "ENVIADO") {
      await client.query("ROLLBACK");
      return { ok: false, error: "PP ENVIADO — Factura Carlos en solo lectura." };
    }

    const fiRes = await client.query<{ estado: string }>(
      `SELECT estado FROM factura_interna WHERE id = $1 AND pp_id = $2 FOR UPDATE`,
      [fiId, ppId],
    );
    if (!fiRes.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false, error: "FI no pertenece a este PP." };
    }
    if (!["RESERVADA", "CONFIRMADA"].includes(fiRes.rows[0].estado)) {
      await client.query("ROLLBACK");
      return { ok: false, error: "FI no editable en este estado." };
    }

    await client.query(
      `UPDATE factura_interna
       SET factura_carlos = $2,
           pv_global = $3,
           factura_carlos_at = CASE WHEN $2 IS NULL THEN NULL ELSE now() END
       WHERE id = $1`,
      [fiId, facturaCarlos, pvGlobal],
    );

    await client.query("COMMIT");

    if (ppRes.rows[0].logistica_on) {
      await syncLogisticaPpIfBandera(pool, ppId);
    }

    return { ok: true, factura_carlos: facturaCarlos, pv_global: pvGlobal };
  } catch (e) {
    await client.query("ROLLBACK");
    const msg = e instanceof Error ? e.message : String(e);
    const dup = pgUniqueViolation(msg);
    if (dup) return { ok: false, error: dup };
    if (msg.includes("chk_fi_factura_carlos_digits")) {
      return { ok: false, error: "Formato Factura Carlos rechazado por BD." };
    }
    return { ok: false, error: msg };
  } finally {
    client.release();
  }
}
