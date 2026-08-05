import type { Pool } from "pg";

export type CarpetaRow = {
  id: number;
  codigo: string;
  nombre: string;
  orden: number;
  no_leidos: number;
};

export type MensajeListRow = {
  id: number;
  asunto: string;
  cuerpo: string;
  origen: string;
  created_at: string;
  leido: boolean;
  carpeta_codigo: string;
  carpeta_nombre: string;
  adjuntos: number;
};

export type MensajeDetalle = MensajeListRow & {
  adjuntos_detalle: {
    id: number;
    nombre_archivo: string;
    storage_path: string | null;
    mime: string;
    bytes: number | null;
    total_pares: number | null;
  }[];
};

export async function listCarpetasConConteo(
  pool: Pool,
  usuarioId: number,
): Promise<CarpetaRow[]> {
  const r = await pool.query<{
    id: string;
    codigo: string;
    nombre: string;
    orden: number;
    no_leidos: string;
  }>(
    `
    SELECT
      c.id::text,
      c.codigo,
      c.nombre,
      c.orden,
      COUNT(d.id) FILTER (WHERE d.leido_at IS NULL)::text AS no_leidos
    FROM public.mensaje_interno_carpeta c
    LEFT JOIN public.mensaje_interno m ON m.carpeta_id = c.id
    LEFT JOIN public.mensaje_interno_destinatario d
      ON d.mensaje_id = m.id AND d.usuario_id = $1
    WHERE c.activo = true
    GROUP BY c.id, c.codigo, c.nombre, c.orden
    ORDER BY c.orden, c.nombre
    `,
    [usuarioId],
  );
  return r.rows.map((row) => ({
    id: Number(row.id),
    codigo: row.codigo,
    nombre: row.nombre,
    orden: row.orden,
    no_leidos: Number(row.no_leidos) || 0,
  }));
}

export async function listMensajesCarpeta(
  pool: Pool,
  usuarioId: number,
  carpetaCodigo: string,
): Promise<MensajeListRow[]> {
  const r = await pool.query<{
    id: string;
    asunto: string;
    cuerpo: string;
    origen: string;
    created_at: Date;
    leido: boolean;
    carpeta_codigo: string;
    carpeta_nombre: string;
    adjuntos: string;
  }>(
    `
    SELECT
      m.id::text,
      m.asunto,
      m.cuerpo,
      m.origen,
      m.created_at,
      (d.leido_at IS NOT NULL) AS leido,
      c.codigo AS carpeta_codigo,
      c.nombre AS carpeta_nombre,
      (SELECT COUNT(*)::text FROM public.mensaje_interno_adjunto a WHERE a.mensaje_id = m.id) AS adjuntos
    FROM public.mensaje_interno_destinatario d
    JOIN public.mensaje_interno m ON m.id = d.mensaje_id
    JOIN public.mensaje_interno_carpeta c ON c.id = m.carpeta_id
    WHERE d.usuario_id = $1
      AND c.codigo = $2
      AND c.activo = true
    ORDER BY m.created_at DESC
    LIMIT 200
    `,
    [usuarioId, carpetaCodigo],
  );
  return r.rows.map((row) => ({
    id: Number(row.id),
    asunto: row.asunto,
    cuerpo: row.cuerpo,
    origen: row.origen,
    created_at: row.created_at.toISOString(),
    leido: row.leido,
    carpeta_codigo: row.carpeta_codigo,
    carpeta_nombre: row.carpeta_nombre,
    adjuntos: Number(row.adjuntos) || 0,
  }));
}

export async function getMensajeDetalle(
  pool: Pool,
  usuarioId: number,
  mensajeId: number,
): Promise<MensajeDetalle | null> {
  const r = await pool.query<{
    id: string;
    asunto: string;
    cuerpo: string;
    origen: string;
    created_at: Date;
    leido: boolean;
    carpeta_codigo: string;
    carpeta_nombre: string;
  }>(
    `
    SELECT
      m.id::text,
      m.asunto,
      m.cuerpo,
      m.origen,
      m.created_at,
      (d.leido_at IS NOT NULL) AS leido,
      c.codigo AS carpeta_codigo,
      c.nombre AS carpeta_nombre
    FROM public.mensaje_interno_destinatario d
    JOIN public.mensaje_interno m ON m.id = d.mensaje_id
    JOIN public.mensaje_interno_carpeta c ON c.id = m.carpeta_id
    WHERE d.usuario_id = $1 AND m.id = $2
    LIMIT 1
    `,
    [usuarioId, mensajeId],
  );
  if (!r.rows[0]) return null;
  const row = r.rows[0];
  const adj = await pool.query<{
    id: string;
    nombre_archivo: string;
    storage_path: string | null;
    mime: string;
    bytes: string | null;
    total_pares: string | null;
  }>(
    `
    SELECT id::text, nombre_archivo, storage_path, mime, bytes::text,
           total_pares::text
    FROM public.mensaje_interno_adjunto
    WHERE mensaje_id = $1
    ORDER BY id
    `,
    [mensajeId],
  );
  return {
    id: Number(row.id),
    asunto: row.asunto,
    cuerpo: row.cuerpo,
    origen: row.origen,
    created_at: row.created_at.toISOString(),
    leido: row.leido,
    carpeta_codigo: row.carpeta_codigo,
    carpeta_nombre: row.carpeta_nombre,
    adjuntos: adj.rows.length,
    adjuntos_detalle: adj.rows.map((a) => ({
      id: Number(a.id),
      nombre_archivo: a.nombre_archivo,
      storage_path: a.storage_path,
      mime: a.mime,
      bytes: a.bytes != null ? Number(a.bytes) : null,
      total_pares: a.total_pares != null ? Number(a.total_pares) : null,
    })),
  };
}

export async function marcarLeido(
  pool: Pool,
  usuarioId: number,
  mensajeId: number,
): Promise<boolean> {
  const r = await pool.query(
    `
    UPDATE public.mensaje_interno_destinatario
    SET leido_at = COALESCE(leido_at, now())
    WHERE usuario_id = $1 AND mensaje_id = $2
    RETURNING id
    `,
    [usuarioId, mensajeId],
  );
  return (r.rowCount ?? 0) > 0;
}

/**
 * Depósito desde Automatización 2.3.1.35.
 * Solo destinatarios configurados (anti-saturación).
 */
export async function depositarMensajeAutomatizacion(
  pool: Pool,
  opts: {
    carpetaCodigo?: string;
    automatizacionId?: number | null;
    asunto: string;
    cuerpo?: string;
    usuarioIds: number[];
    adjuntos?: {
      nombre_archivo: string;
      storage_path?: string | null;
      bytes?: number | null;
      total_pares?: number | null;
    }[];
    createdByUsuarioId?: number | null;
  },
): Promise<number | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const carp = await client.query<{ id: string }>(
      `SELECT id::text FROM mensaje_interno_carpeta WHERE codigo = $1 AND activo LIMIT 1`,
      [opts.carpetaCodigo ?? "STOCK_PRONTA_ENTREGA"],
    );
    if (!carp.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }
    const ins = await client.query<{ id: string }>(
      `
      INSERT INTO mensaje_interno (
        carpeta_id, origen, automatizacion_id, asunto, cuerpo, created_by_usuario_id
      ) VALUES ($1, 'AUTOMATIZACION', $2, $3, $4, $5)
      RETURNING id::text
      `,
      [
        Number(carp.rows[0].id),
        opts.automatizacionId ?? null,
        opts.asunto,
        opts.cuerpo ?? "",
        opts.createdByUsuarioId ?? null,
      ],
    );
    const mensajeId = Number(ins.rows[0]!.id);
    for (const uid of [...new Set(opts.usuarioIds)]) {
      if (!Number.isFinite(uid) || uid <= 0) continue;
      await client.query(
        `
        INSERT INTO mensaje_interno_destinatario (mensaje_id, usuario_id)
        VALUES ($1, $2)
        ON CONFLICT (mensaje_id, usuario_id) DO NOTHING
        `,
        [mensajeId, uid],
      );
    }
    for (const a of opts.adjuntos ?? []) {
      await client.query(
        `
        INSERT INTO mensaje_interno_adjunto (
          mensaje_id, nombre_archivo, storage_path, bytes, total_pares
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          mensajeId,
          a.nombre_archivo,
          a.storage_path ?? null,
          a.bytes ?? null,
          a.total_pares ?? null,
        ],
      );
    }
    await client.query("COMMIT");
    return mensajeId;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
