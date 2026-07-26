import type { Pool, PoolClient } from "pg";
import type { EntidadAmLogistica } from "./constants";
import { FECHA_ENTREGA_REAL_LABEL } from "./constants";
import { getLogisticaPpStats, sqlFiCajasSubquery } from "./fi-cajas";
import { rigorFiPeLogistica } from "./pe-pp-contrato";

export type LogisticaPublishResult =
  | { ok: true; synced: number; n_fi: number; cajas: number }
  | { ok: false; error: string };

export async function resolverEntidadAm(client: Pool | PoolClient, ppId: number): Promise<EntidadAmLogistica> {
  try {
    const { rows } = await client.query<{ e: string }>(
      `SELECT public.logistica_ok_resolver_entidad_am($1::int) AS e`,
      [ppId],
    );
    const e = rows[0]?.e;
    if (e === "PE" || e === "CP" || e === "PROGRAMADO") return e;
  } catch {
    /* MIG-167 pendiente — fallback TS */
  }

  const { rows } = await client.query<{ categoria_id: string | null; quincena: string | null }>(
    `
    SELECT COALESCE(
             pp.categoria_id,
             (SELECT ic.categoria_id FROM intencion_compra_pedido icp
              JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
              WHERE icp.pedido_proveedor_id = pp.id LIMIT 1)
           )::text AS categoria_id,
           qa.descripcion AS quincena
    FROM pedido_proveedor pp
    LEFT JOIN quincena_arribo qa ON qa.id = pp.quincena_arribo_id
    WHERE pp.id = $1
    `,
    [ppId],
  );
  const r = rows[0];
  if (r?.quincena && /^pronta\s*entrega$/i.test(r.quincena.trim())) return "PE";
  if (Number(r?.categoria_id) === 3) return "PROGRAMADO";
  return "CP";
}

/** Copia FI CONFIRMADA del PP → logistica_pendiente_confirmacion */
export async function syncLogisticaPp(
  client: Pool | PoolClient,
  ppId: number,
  fechaOrden: string,
): Promise<{ ok: true; synced: number } | { ok: false; error: string }> {
  const fecha = fechaOrden?.trim().slice(0, 10);
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return { ok: false, error: `${FECHA_ENTREGA_REAL_LABEL} inválida.` };
  }

  const entidad = await resolverEntidadAm(client, ppId);

  if (entidad === "PE") {
    const rigor = rigorFiPeLogistica({
      nro_factura: "PE-SYNC",
      pp_id: ppId,
      fecha_arribo_real: fecha,
    });
    if (!rigor.ok) return rigor;

    const orphans = await client.query<{ n: string }>(
      `
      SELECT COUNT(*)::text AS n
      FROM factura_interna fi
      WHERE fi.pp_id = $1
        AND TRIM(COALESCE(fi.nro_factura, '')) LIKE 'PE-%'
        AND fi.estado IN ('CONFIRMADA', 'RESERVADA')
        AND fi.cliente_id IS NULL
      `,
      [ppId],
    );
    if (Number(orphans.rows[0]?.n ?? 0) > 0) {
      return {
        ok: false,
        error: `FI PE del PP ${ppId} sin cliente_id — no se publica a Logística OK.`,
      };
    }
  }

  const cajasSql = sqlFiCajasSubquery("fi");

  const { rowCount } = await client.query(
    `
    INSERT INTO logistica_pendiente_confirmacion (
      factura_interna_id, pedido_proveedor_id, entidad_am, fecha_orden,
      id_cliente, id_cadena, id_vendedor, pares, cajas, monto_neto, nro_factura,
      fecha_entrega_vendedor, estado, updated_at
    )
    SELECT
      fi.id,
      fi.pp_id,
      $3::text,
      $2::date,
      fi.cliente_id,
      cad.id_cadena,
      fi.vendedor_id,
      COALESCE(fi.total_pares, 0)::int,
      ${cajasSql},
      fi.total_monto,
      fi.nro_factura,
      CASE
        WHEN fi.fecha_entrega_cliente IS NOT NULL
         AND EXTRACT(YEAR FROM fi.fecha_entrega_cliente::timestamp) >= 2000
        THEN fi.fecha_entrega_cliente
        ELSE NULL
      END,
      CASE
        WHEN fi.fecha_entrega_cliente IS NOT NULL
         AND EXTRACT(YEAR FROM fi.fecha_entrega_cliente::timestamp) >= 2000
        THEN 'CONFIRMADA'
        ELSE 'PENDIENTE'
      END,
      now()
    FROM factura_interna fi
    LEFT JOIN LATERAL (
      SELECT cc.id_cadena
      FROM cliente_cadena_v2 cc
      WHERE cc.id_cliente = fi.cliente_id
      ORDER BY cc.id_cadena
      LIMIT 1
    ) cad ON true
    WHERE fi.pp_id = $1
      AND fi.estado IN ('CONFIRMADA', 'RESERVADA')
      AND fi.cliente_id IS NOT NULL
    ON CONFLICT (factura_interna_id) DO UPDATE SET
      pedido_proveedor_id = EXCLUDED.pedido_proveedor_id,
      entidad_am = EXCLUDED.entidad_am,
      fecha_orden = EXCLUDED.fecha_orden,
      id_cliente = EXCLUDED.id_cliente,
      id_cadena = EXCLUDED.id_cadena,
      id_vendedor = EXCLUDED.id_vendedor,
      pares = EXCLUDED.pares,
      cajas = EXCLUDED.cajas,
      monto_neto = EXCLUDED.monto_neto,
      nro_factura = EXCLUDED.nro_factura,
      fecha_entrega_vendedor = COALESCE(
        EXCLUDED.fecha_entrega_vendedor,
        logistica_pendiente_confirmacion.fecha_entrega_vendedor
      ),
      estado = CASE
        WHEN EXCLUDED.fecha_entrega_vendedor IS NOT NULL THEN 'CONFIRMADA'
        ELSE logistica_pendiente_confirmacion.estado
      END,
      updated_at = now()
    WHERE logistica_pendiente_confirmacion.estado = 'PENDIENTE'
    `,
    [ppId, fecha, entidad],
  );

  return { ok: true, synced: rowCount ?? 0 };
}

export async function publicarLogisticaPp(
  pool: Pool,
  ppId: number,
  fechaEntregaReal: string,
  usuarioId: number | null,
): Promise<LogisticaPublishResult> {
  const fecha = fechaEntregaReal?.trim().slice(0, 10);
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return { ok: false, error: `${FECHA_ENTREGA_REAL_LABEL} obligatoria (YYYY-MM-DD).` };
  }

  const client = await pool.connect();
  let synced = 0;
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
    if (ppRes.rows[0].estado === "ANULADO") {
      await client.query("ROLLBACK");
      return { ok: false, error: "PP anulado." };
    }

    await client.query(
      `
      UPDATE pedido_proveedor SET
        fecha_arribo_real = $2::date,
        logistica_bandera_activa = true,
        logistica_activada_at = now(),
        logistica_activada_por = $3
      WHERE id = $1
      `,
      [ppId, fecha, usuarioId],
    );

    const sync = await syncLogisticaPp(client, ppId, fecha);
    if (!sync.ok) {
      await client.query("ROLLBACK");
      return sync;
    }

    await client.query("COMMIT");
    synced = sync.synced;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    const msg = e instanceof Error ? e.message : "Error al activar logística";
    if (/logistica_pendiente_confirmacion|cajas/.test(msg)) {
      return { ok: false, error: "Tabla logística incompleta — aplicar MIG-167 y MIG-168." };
    }
    return { ok: false, error: msg };
  } finally {
    client.release();
  }

  const stats = await getLogisticaPpStats(pool, ppId);
  return { ok: true, synced, n_fi: stats.n_fi, cajas: stats.cajas };
}

/** Alias histórico */
export const activarLogisticaPp = publicarLogisticaPp;

export async function despublicarLogisticaPp(
  pool: Pool,
  ppId: number,
): Promise<{ ok: true; removed: number } | { ok: false; error: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ppRes = await client.query(`SELECT id FROM pedido_proveedor WHERE id = $1 FOR UPDATE`, [ppId]);
    if (!ppRes.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false, error: "PP no encontrado." };
    }

    const del = await client.query(
      `DELETE FROM logistica_pendiente_confirmacion
       WHERE pedido_proveedor_id = $1 AND estado = 'PENDIENTE'`,
      [ppId],
    );

    await client.query(
      `UPDATE pedido_proveedor SET logistica_bandera_activa = false WHERE id = $1`,
      [ppId],
    );

    await client.query("COMMIT");
    return { ok: true, removed: del.rowCount ?? 0 };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, error: e instanceof Error ? e.message : "Error al despublicar" };
  } finally {
    client.release();
  }
}

/** Llamar tras generar / confirmar FI si PP tiene bandera ON + Fecha de entrega Real. */
export async function syncLogisticaPpIfBandera(pool: Pool, ppId: number): Promise<void> {
  const { rows } = await pool.query<{ fecha: string | null; activa: boolean }>(
    `SELECT fecha_arribo_real::text AS fecha, logistica_bandera_activa AS activa
     FROM pedido_proveedor WHERE id = $1`,
    [ppId],
  );
  const r = rows[0];
  if (!r?.activa || !r.fecha) return;

  const entidad = await resolverEntidadAm(pool, ppId);
  if (entidad === "PE") {
    const rigor = rigorFiPeLogistica({
      nro_factura: "PE-SYNC",
      pp_id: ppId,
      fecha_arribo_real: r.fecha,
    });
    if (!rigor.ok) {
      console.warn(`[logistica] sync PE omitido PP ${ppId}:`, rigor.error);
      return;
    }
  }

  await syncLogisticaPp(pool, ppId, r.fecha.slice(0, 10));
}

/** Fecha orden logística: rechaza años basura (ej. 0020-07-27 del carrito). */
function fechaOrdenLogisticaValida(...cands: Array<string | null | undefined>): string {
  const today = new Date().toISOString().slice(0, 10);
  for (const c of cands) {
    const d = String(c ?? "").trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && Number(d.slice(0, 4)) >= 2000) return d;
  }
  return today;
}

/**
 * Post-Confirmar FI en Aprobaciones.
 * · CP / PROGRAMADO: solo si bandera + Fecha de entrega Real (mismo que syncLogisticaPpIfBandera).
 * · PE: stock local — entra a Logística OK al confirmar (sin exigir bandera previa).
 *   Activa bandera + fecha_arribo_real si faltaban. PE siempre sortPriority 0 en bandeja.
 */
export async function syncLogisticaTrasConfirmarFi(
  pool: Pool,
  fiId: number,
  ppId: number,
): Promise<{ ok: true; entidad: EntidadAmLogistica; synced?: number } | { ok: false; error: string }> {
  const entidad = await resolverEntidadAm(pool, ppId);

  if (entidad !== "PE") {
    await syncLogisticaPpIfBandera(pool, ppId);
    return { ok: true, entidad };
  }

  const { rows } = await pool.query<{
    fecha_pp: string | null;
    fecha_fi: string | null;
    nro_factura: string | null;
  }>(
    `
    SELECT pp.fecha_arribo_real::text AS fecha_pp,
           fi.fecha_entrega_cliente::text AS fecha_fi,
           fi.nro_factura
    FROM factura_interna fi
    JOIN pedido_proveedor pp ON pp.id = fi.pp_id
    WHERE fi.id = $1
    `,
    [fiId],
  );
  const row = rows[0];
  const fecha = fechaOrdenLogisticaValida(row?.fecha_pp, row?.fecha_fi);

  const rigor = rigorFiPeLogistica({
    nro_factura: row?.nro_factura ?? "PE-SYNC",
    pp_id: ppId,
    fecha_arribo_real: fecha,
  });
  if (!rigor.ok) return rigor;

  await pool.query(
    `
    UPDATE pedido_proveedor SET
      fecha_arribo_real = COALESCE(fecha_arribo_real, $2::date),
      logistica_bandera_activa = true,
      logistica_activada_at = COALESCE(logistica_activada_at, now())
    WHERE id = $1
    `,
    [ppId, fecha],
  );

  const sync = await syncLogisticaPp(pool, ppId, fecha);
  if (!sync.ok) return sync;
  return { ok: true, entidad, synced: sync.synced };
}

