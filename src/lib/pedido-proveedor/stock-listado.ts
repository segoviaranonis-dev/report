import type { Pool } from "pg";

export type EventoPrecioOption = {
  id: number;
  nombre: string;
  estado: string;
  n_precios: number;
  biblioteca: string | null;
  vigente: boolean;
};

export type EventoPpDetalle = {
  evento_id: number;
  nombre_evento: string;
  estado: string;
  n_precios: number;
  biblioteca: string | null;
  biblioteca_id: number | null;
};

export function factorDescuentosFob(d1: number, d2: number, d3: number, d4: number): number {
  return [d1, d2, d3, d4].reduce((acc, d) => acc * (1 - Math.max(0, d) / 100), 1);
}

export async function listEventosPrecioPp(pool: Pool, ppId: number): Promise<EventoPrecioOption[]> {
  const vigenteRes = await pool.query<{ id: string | null }>(
    `SELECT icp.precio_evento_id::text AS id
     FROM intencion_compra_pedido icp
     WHERE icp.pedido_proveedor_id = $1 AND icp.precio_evento_id IS NOT NULL
     ORDER BY icp.id LIMIT 1`,
    [ppId],
  );
  const vigenteId = vigenteRes.rows[0]?.id ? Number(vigenteRes.rows[0].id) : null;

  const { rows } = await pool.query<{
    id: string;
    nombre: string;
    estado: string;
    n_precios: string;
    biblioteca: string | null;
  }>(
    `
    SELECT pe.id::text AS id,
           pe.nombre_evento AS nombre,
           COALESCE(pe.estado, '—') AS estado,
           COUNT(pl.id)::text AS n_precios,
           bp.nombre AS biblioteca
    FROM precio_evento pe
    LEFT JOIN precio_lista pl ON pl.evento_id = pe.id
    LEFT JOIN biblioteca_precio bp ON bp.id = pe.biblioteca_precio_id
    GROUP BY pe.id, pe.nombre_evento, pe.estado, bp.nombre, pe.created_at
    ORDER BY pe.created_at DESC
    LIMIT 80
    `,
  );

  return rows.map((r) => ({
    id: Number(r.id),
    nombre: r.nombre,
    estado: r.estado,
    n_precios: Number(r.n_precios ?? 0),
    biblioteca: r.biblioteca,
    vigente: vigenteId != null && Number(r.id) === vigenteId,
  }));
}

export async function getEventoPpDetalle(pool: Pool, ppId: number): Promise<EventoPpDetalle | null> {
  const { rows } = await pool.query<{
    evento_id: string;
    nombre_evento: string;
    estado: string;
    n_precios: string;
    biblioteca: string | null;
    biblioteca_id: string | null;
  }>(
    `
    SELECT pe.id::text AS evento_id,
           pe.nombre_evento,
           COALESCE(pe.estado, '—') AS estado,
           (SELECT COUNT(*)::text FROM precio_lista pl WHERE pl.evento_id = pe.id) AS n_precios,
           bp.nombre AS biblioteca,
           bp.id::text AS biblioteca_id
    FROM intencion_compra_pedido icp
    JOIN precio_evento pe ON pe.id = icp.precio_evento_id
    LEFT JOIN biblioteca_precio bp ON bp.id = pe.biblioteca_precio_id
    WHERE icp.pedido_proveedor_id = $1 AND icp.precio_evento_id IS NOT NULL
    ORDER BY icp.id
    LIMIT 1
    `,
    [ppId],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    evento_id: Number(r.evento_id),
    nombre_evento: r.nombre_evento,
    estado: r.estado,
    n_precios: Number(r.n_precios ?? 0),
    biblioteca: r.biblioteca,
    biblioteca_id: r.biblioteca_id ? Number(r.biblioteca_id) : null,
  };
}

export async function vincularListadoAPp(
  pool: Pool,
  ppId: number,
  eventoId: number,
  usuarioId: number | null,
  incluirVendidos = false,
): Promise<{ ok: true; actualizados?: number; detalle?: Record<string, unknown> } | { ok: false; error: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE intencion_compra_pedido SET precio_evento_id = $2 WHERE pedido_proveedor_id = $1`,
      [ppId, eventoId],
    );
    await client.query(
      `UPDATE intencion_compra ic SET precio_evento_id = $2
       FROM intencion_compra_pedido icp
       WHERE icp.intencion_compra_id = ic.id AND icp.pedido_proveedor_id = $1`,
      [ppId, eventoId],
    );

    const fn = await client.query<{
      result: {
        success?: boolean;
        error?: string;
        actualizados?: number;
        filas_congeladas_venta?: number;
        filas_vendidas_forzadas?: number;
        detail?: string;
      };
    }>(`SELECT vincular_listado_a_pp($1, $2, $3, $4) AS result`, [
      ppId,
      eventoId,
      usuarioId,
      incluirVendidos,
    ]);
    const result = fn.rows[0]?.result;
    if (!result?.success) {
      await client.query("ROLLBACK");
      return { ok: false, error: result?.error ?? "Error al vincular listado." };
    }

    await client.query("COMMIT");
    return { ok: true, actualizados: result.actualizados, detalle: result };
  } catch (e) {
    await client.query("ROLLBACK");
    const msg = e instanceof Error ? e.message : "Error al vincular";
    if (msg.includes("vincular_listado_a_pp")) {
      return { ok: false, error: "Función vincular_listado_a_pp no existe en BD — aplicar MIG-150." };
    }
    return { ok: false, error: msg };
  } finally {
    client.release();
  }
}
