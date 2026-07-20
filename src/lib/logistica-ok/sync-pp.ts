import type { Pool, PoolClient } from "pg";
import type { EntidadAmLogistica } from "./constants";
import { FECHA_ENTREGA_REAL_LABEL } from "./constants";
import { getLogisticaPpStats, sqlFiCajasSubquery } from "./fi-cajas";

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

  const cajasSql = sqlFiCajasSubquery("fi");

  const { rowCount } = await client.query(
    `
    INSERT INTO logistica_pendiente_confirmacion (
      factura_interna_id, pedido_proveedor_id, entidad_am, fecha_orden,
      id_cliente, id_cadena, id_vendedor, pares, cajas, monto_neto, nro_factura, updated_at
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
      AND fi.estado = 'CONFIRMADA'
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
    const stats = await getLogisticaPpStats(pool, ppId);
    return { ok: true, synced: sync.synced, n_fi: stats.n_fi, cajas: stats.cajas };
  } catch (e) {
    await client.query("ROLLBACK");
    const msg = e instanceof Error ? e.message : "Error al activar logística";
    if (/logistica_pendiente_confirmacion|cajas/.test(msg)) {
      return { ok: false, error: "Tabla logística incompleta — aplicar MIG-167 y MIG-168." };
    }
    return { ok: false, error: msg };
  } finally {
    client.release();
  }
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

/** Llamar tras generar FI si PP tiene bandera ON */
export async function syncLogisticaPpIfBandera(pool: Pool, ppId: number): Promise<void> {
  const { rows } = await pool.query<{ fecha: string | null; activa: boolean }>(
    `SELECT fecha_arribo_real::text AS fecha, logistica_bandera_activa AS activa
     FROM pedido_proveedor WHERE id = $1`,
    [ppId],
  );
  const r = rows[0];
  if (!r?.activa || !r.fecha) return;
  await syncLogisticaPp(pool, ppId, r.fecha.slice(0, 10));
}
