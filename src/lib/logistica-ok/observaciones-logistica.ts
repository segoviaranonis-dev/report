import type { Pool, PoolClient } from "pg";

export type OrigenObsLogistica = "IC" | "PP" | "PE_WEB" | "APROBACION";

export type LogisticaObservacionRow = {
  id: number;
  intencion_compra_id: number | null;
  pedido_proveedor_id: number | null;
  factura_interna_id: number | null;
  origen: OrigenObsLogistica;
  usuario_id: number | null;
  usuario_nombre: string;
  texto: string;
  created_at: string;
};

export type AppendObsLogisticaInput = {
  texto: string;
  origen: OrigenObsLogistica;
  usuarioId: number | null;
  usuarioNombre: string;
  intencionCompraId?: number | null;
  pedidoProveedorId?: number | null;
  facturaInternaId?: number | null;
};

type Db = Pool | PoolClient;

function trimTexto(texto: string): string {
  return texto.trim().slice(0, 2000);
}

export async function appendObservacionLogistica(
  db: Db,
  input: AppendObsLogisticaInput,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const texto = trimTexto(input.texto);
  if (!texto) return { ok: false, error: "Texto de observación vacío." };
  const nombre = (input.usuarioNombre || "Usuario").trim().slice(0, 120);
  if (!nombre) return { ok: false, error: "Nombre de usuario requerido." };

  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO logistica_observacion (
       intencion_compra_id, pedido_proveedor_id, factura_interna_id,
       origen, usuario_id, usuario_nombre, texto
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      input.intencionCompraId ?? null,
      input.pedidoProveedorId ?? null,
      input.facturaInternaId ?? null,
      input.origen,
      input.usuarioId,
      nombre,
      texto,
    ],
  );
  return { ok: true, id: Number(rows[0].id) };
}

/** Enlaza obs pendientes de IC a FIs ya emitidas en el PP (por notas = nro IC). */
export async function vincularObsIcAFisExistentes(
  db: Db,
  icId: number,
  ppId: number,
): Promise<void> {
  await db.query(
    `UPDATE logistica_observacion lo
     SET factura_interna_id = fi.id,
         pedido_proveedor_id = COALESCE(lo.pedido_proveedor_id, $2)
     FROM factura_interna fi
     JOIN intencion_compra ic ON ic.numero_registro = fi.notas
     WHERE lo.intencion_compra_id = $1
       AND ic.id = $1
       AND fi.pp_id = $2
       AND lo.factura_interna_id IS NULL`,
    [icId, ppId],
  );
}

/** Enlaza obs de IC (y PP) a FI recién generada. */
export async function vincularObservacionesIcAFi(
  db: Db,
  icId: number,
  fiId: number,
  ppId: number,
): Promise<void> {
  await db.query(
    `UPDATE logistica_observacion
     SET factura_interna_id = $1,
         pedido_proveedor_id = COALESCE(pedido_proveedor_id, $3)
     WHERE intencion_compra_id = $2
       AND (factura_interna_id IS NULL OR factura_interna_id = $1)`,
    [fiId, icId, ppId],
  );
}

export async function listObservacionesPorFi(
  db: Db,
  fiId: number,
): Promise<LogisticaObservacionRow[]> {
  const { rows } = await db.query<LogisticaObservacionRow>(
    `SELECT id, intencion_compra_id, pedido_proveedor_id, factura_interna_id,
            origen, usuario_id, usuario_nombre, texto, created_at::text
     FROM logistica_observacion
     WHERE factura_interna_id = $1
     ORDER BY created_at ASC, id ASC`,
    [fiId],
  );
  return rows.map((r) => ({ ...r, id: Number(r.id) }));
}

export async function listObservacionesPorIc(
  db: Db,
  icId: number,
): Promise<LogisticaObservacionRow[]> {
  const { rows } = await db.query<LogisticaObservacionRow>(
    `SELECT id, intencion_compra_id, pedido_proveedor_id, factura_interna_id,
            origen, usuario_id, usuario_nombre, texto, created_at::text
     FROM logistica_observacion
     WHERE intencion_compra_id = $1
     ORDER BY created_at ASC, id ASC`,
    [icId],
  );
  return rows.map((r) => ({ ...r, id: Number(r.id) }));
}

export async function marcarObservacionLeida(
  db: Db,
  fiId: number,
  usuarioId: number,
  pestana: string,
): Promise<void> {
  const pest = pestana.trim().slice(0, 40);
  const { rows } = await db.query<{ ultimo: string | null }>(
    `SELECT MAX(id)::text AS ultimo FROM logistica_observacion WHERE factura_interna_id = $1`,
    [fiId],
  );
  const ultimo = rows[0]?.ultimo != null ? Number(rows[0].ultimo) : null;
  await db.query(
    `INSERT INTO logistica_observacion_lectura
       (factura_interna_id, usuario_id, pestana, ultimo_obs_id, leido_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (factura_interna_id, usuario_id, pestana)
     DO UPDATE SET ultimo_obs_id = EXCLUDED.ultimo_obs_id, leido_at = now()`,
    [fiId, usuarioId, pest, ultimo],
  );
}

export type ObsFlagsFi = { count: number; noLeida: boolean };

export async function fetchObsFlagsPorFiIds(
  db: Db,
  fiIds: number[],
  usuarioId: number | null,
  pestana: string | null,
): Promise<Map<number, ObsFlagsFi>> {
  const map = new Map<number, ObsFlagsFi>();
  if (!fiIds.length) return map;

  const { rows: counts } = await db.query<{ fi_id: string; cnt: string; ultimo: string | null }>(
    `SELECT factura_interna_id AS fi_id,
            COUNT(*)::text AS cnt,
            MAX(id)::text AS ultimo
     FROM logistica_observacion
     WHERE factura_interna_id = ANY($1::int[])
     GROUP BY factura_interna_id`,
    [fiIds],
  );

  const lecturas = new Map<number, number>();
  if (usuarioId != null && pestana) {
    const { rows: leidos } = await db.query<{ fi_id: string; ultimo: string | null }>(
      `SELECT factura_interna_id AS fi_id, ultimo_obs_id::text AS ultimo
       FROM logistica_observacion_lectura
       WHERE factura_interna_id = ANY($1::int[])
         AND usuario_id = $2
         AND pestana = $3`,
      [fiIds, usuarioId, pestana.trim().slice(0, 40)],
    );
    for (const r of leidos) {
      lecturas.set(Number(r.fi_id), r.ultimo != null ? Number(r.ultimo) : 0);
    }
  }

  for (const r of counts) {
    const fiId = Number(r.fi_id);
    const count = Number(r.cnt);
    const ultimo = r.ultimo != null ? Number(r.ultimo) : 0;
    const leidoHasta = lecturas.get(fiId) ?? 0;
    map.set(fiId, { count, noLeida: count > 0 && ultimo > leidoHasta });
  }
  return map;
}

/** Propaga obs PE a todas las FI del pedido (post confirmar web). */
export async function appendObsPeAFacturasPedido(
  db: Db,
  pedidoId: number,
  input: Omit<AppendObsLogisticaInput, "facturaInternaId" | "origen">,
): Promise<void> {
  const texto = trimTexto(input.texto);
  if (!texto) return;
  const { rows: fis } = await db.query<{ id: string }>(
    `SELECT id FROM factura_interna WHERE pedido_id = $1`,
    [pedidoId],
  );
  for (const fi of fis) {
    await appendObservacionLogistica(db, {
      ...input,
      origen: "PE_WEB",
      facturaInternaId: Number(fi.id),
    });
  }
}
