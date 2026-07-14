/**
 * 2.3.1.9.C — Anular FI entera + reintegrar stock (Nivel Dios).
 * Canon: CHUSAR_BOTON_DIOS_ANULAR_REINTEGRAR_FI.md
 * Solo servidor (API / server actions) — no importar desde client components.
 */
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type SqlClient = {
  query: <T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ) => Promise<{ rows: T[]; rowCount: number | null }>;
};

export type AnularReintegrarResult =
  | {
      ok: true;
      msg: string;
      fi_id: number;
      nro_factura: string;
      estado_previo: string;
      pares_reintegrados_ppd: number;
      lineas_ppd: number;
      lineas_sin_ppd: number;
    }
  | { ok: false; msg: string };

const ESTADOS_ANULABLES = new Set(["RESERVADA", "CONFIRMADA"]);
const TRASPASO_BLOQUEADO = new Set(["ENVIADO", "CONFIRMADO"]);

export type AnularReintegrarOpts = {
  /** Aprobaciones: solo RESERVADA. Facturación: RESERVADA + CONFIRMADA. */
  permitirConfirmada: boolean;
  motivo: string;
};

async function bloquearSiTraspasoCerrado(
  client: SqlClient,
  nroFactura: string,
): Promise<string | null> {
  const { rows } = await client.query<{ estado: string }>(
    `SELECT UPPER(TRIM(t.estado)) AS estado
     FROM traspaso t
     WHERE t.documento_ref = $1
     ORDER BY t.id DESC
     LIMIT 1`,
    [nroFactura],
  );
  const estado = rows[0]?.estado;
  if (estado && TRASPASO_BLOQUEADO.has(estado)) {
    return `FI con traspaso ${estado}. Deshacer traspaso web antes de anular (v1).`;
  }
  return null;
}

/**
 * Anula FI entera, reintegra pares a PPD (y snapshot si aplica), registra motivo.
 * No consulta Excel del día.
 */
export async function anularYReintegrarFi(
  fiId: number,
  opts: AnularReintegrarOpts,
): Promise<AnularReintegrarResult> {
  if (!isRimecDatabaseConfigured()) {
    return { ok: false, msg: "DATABASE_URL no configurada." };
  }

  const motivo = (opts.motivo || "").trim();
  if (!motivo) {
    return { ok: false, msg: "Motivo obligatorio." };
  }

  const pool = getRimecPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: fiRows } = await client.query<{
      id: number;
      nro_factura: string;
      estado: string;
      pedido_id: number | null;
    }>(
      `SELECT id, nro_factura, UPPER(TRIM(estado)) AS estado, pedido_id
       FROM factura_interna
       WHERE id = $1
       FOR UPDATE`,
      [fiId],
    );
    const fi = fiRows[0];
    if (!fi) {
      await client.query("ROLLBACK");
      return { ok: false, msg: "Factura interna no encontrada." };
    }

    if (fi.estado === "ANULADA") {
      await client.query("ROLLBACK");
      return { ok: false, msg: "La FI ya está ANULADA." };
    }

    if (!ESTADOS_ANULABLES.has(fi.estado)) {
      await client.query("ROLLBACK");
      return { ok: false, msg: `Estado ${fi.estado} no anulable.` };
    }

    if (fi.estado === "CONFIRMADA" && !opts.permitirConfirmada) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        msg: "En Confirmación solo se anulan FI RESERVADA (pedidos no confirmados).",
      };
    }

    const bloqueo = await bloquearSiTraspasoCerrado(client, fi.nro_factura);
    if (bloqueo) {
      await client.query("ROLLBACK");
      return { ok: false, msg: bloqueo };
    }

    // 1) Reintegrar por ppd_id (tránsito + PE Magno)
    const revPpd = await client.query<{ pares: string }>(
      `UPDATE pedido_proveedor_detalle ppd
       SET pares_vendidos = GREATEST(0, COALESCE(ppd.pares_vendidos, 0) - fid.pares)
       FROM factura_interna_detalle fid
       WHERE fid.factura_id = $1
         AND fid.ppd_id IS NOT NULL
         AND ppd.id = fid.ppd_id
       RETURNING fid.pares`,
      [fiId],
    );
    const paresPpd = revPpd.rows.reduce((s, r) => s + Number(r.pares || 0), 0);

    // 2) Snapshot sin ppd_id (tránsito clásico con fi.pp_id)
    await client.query(
      `UPDATE pedido_proveedor_detalle ppd
       SET pares_vendidos = GREATEST(0, COALESCE(ppd.pares_vendidos, 0) - fid.pares)
       FROM factura_interna_detalle fid
       JOIN factura_interna fi ON fi.id = fid.factura_id
       WHERE fid.factura_id = $1
         AND fid.ppd_id IS NULL
         AND fid.linea_snapshot IS NOT NULL
         AND fi.pp_id IS NOT NULL
         AND ppd.pedido_proveedor_id = fi.pp_id
         AND ppd.linea::text = fid.linea_snapshot::jsonb->>'linea_codigo'
         AND ppd.referencia::text = fid.linea_snapshot::jsonb->>'ref_codigo'`,
      [fiId],
    );

    // 3) PE staging legacy: stock_id en snapshot si existe (v1 best-effort)
    await client.query(
      `UPDATE stock_pronta_entrega_rimec s
       SET cantidad = COALESCE(s.cantidad, 0) + fid.pares,
           updated_at = now()
       FROM factura_interna_detalle fid
       WHERE fid.factura_id = $1
         AND fid.ppd_id IS NULL
         AND (fid.linea_snapshot::jsonb->>'stock_id') ~ '^[0-9]+$'
         AND s.id = (fid.linea_snapshot::jsonb->>'stock_id')::bigint`,
      [fiId],
    );

    const { rows: sinPpd } = await client.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM factura_interna_detalle
       WHERE factura_id = $1 AND ppd_id IS NULL`,
      [fiId],
    );

    const notas = `[DIOS anular+reintegrar ${new Date().toISOString().slice(0, 10)}] ${motivo}`;

    await client.query(
      `UPDATE factura_interna
       SET estado = 'ANULADA',
           notas = CASE
             WHEN notas IS NULL OR TRIM(notas) = '' THEN $2
             ELSE notas || E'\\n' || $2
           END
       WHERE id = $1`,
      [fiId, notas],
    );

    // Pedido web: si todas las FI del pedido quedaron ANULADA y sigue PENDIENTE → RECHAZADO
    if (fi.pedido_id != null) {
      const { rows: vivos } = await client.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM factura_interna
         WHERE pedido_id = $1 AND UPPER(TRIM(estado)) <> 'ANULADA'`,
        [fi.pedido_id],
      );
      if (Number(vivos[0]?.c || 0) === 0) {
        await client.query(
          `UPDATE pedido_venta_rimec
           SET estado = 'RECHAZADO', motivo_rechazo = $2
           WHERE id = $1 AND UPPER(TRIM(estado)) = 'PENDIENTE'`,
          [fi.pedido_id, motivo],
        );
      }
    }

    await client.query("COMMIT");
    return {
      ok: true,
      msg: `FI ${fi.nro_factura} ANULADA · stock reintegrado · registrada en Anulaciones.`,
      fi_id: fi.id,
      nro_factura: fi.nro_factura,
      estado_previo: fi.estado,
      pares_reintegrados_ppd: paresPpd,
      lineas_ppd: revPpd.rowCount ?? 0,
      lineas_sin_ppd: Number(sinPpd[0]?.c || 0),
    };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, msg: e instanceof Error ? e.message : String(e) };
  } finally {
    client.release();
  }
}

export async function anularYReintegrarFiPorNro(
  nroFactura: string,
  opts: AnularReintegrarOpts,
): Promise<AnularReintegrarResult> {
  if (!isRimecDatabaseConfigured()) {
    return { ok: false, msg: "DATABASE_URL no configurada." };
  }
  const pool = getRimecPool();
  const { rows } = await pool.query<{ id: number }>(
    `SELECT id FROM factura_interna WHERE nro_factura = $1 LIMIT 1`,
    [nroFactura],
  );
  if (!rows[0]) return { ok: false, msg: "Factura no encontrada." };
  return anularYReintegrarFi(rows[0].id, opts);
}
