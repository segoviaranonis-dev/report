import type { Pool } from "pg";

export type CierreResult = {
  ok: true;
  evento_id: number;
  n_precio_lista: number;
  proveedor_id: number;
};

export async function cerrarEventoPrecio(
  pool: Pool,
  eventoId: number,
  usuarioId?: number | null,
): Promise<{ ok: true; data: CierreResult } | { ok: false; error: string }> {
  const { rows: evRows } = await pool.query<{
    estado: string;
    proveedor_id: string;
    nombre_evento: string;
  }>(
    `SELECT estado, proveedor_id, nombre_evento FROM precio_evento WHERE id = $1`,
    [eventoId],
  );
  const ev = evRows[0];
  if (!ev) return { ok: false, error: "Evento no encontrado" };

  const estado = String(ev.estado).toLowerCase();
  if (estado === "cerrado") return { ok: false, error: "El evento ya está cerrado." };

  const { rows: plRows } = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM precio_lista WHERE evento_id = $1`,
    [eventoId],
  );
  const nPl = Number(plRows[0]?.n ?? 0);
  if (nPl <= 0) return { ok: false, error: "No hay precio_lista — no se puede cerrar." };

  const proveedorId = Number(ev.proveedor_id);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE precio_evento SET estado = 'cerrado' WHERE id = $1`,
      [eventoId],
    );

    const vigCol = await client.query<{ ok: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'precio_lista' AND column_name = 'vigente'
       ) AS ok`,
    );
    if (vigCol.rows[0]?.ok) {
      await client.query(
        `UPDATE precio_lista SET vigente = false
         WHERE evento_id IN (
           SELECT id FROM precio_evento WHERE proveedor_id = $1 AND id <> $2
         )`,
        [proveedorId, eventoId],
      );
      await client.query(`UPDATE precio_lista SET vigente = true WHERE evento_id = $1`, [eventoId]);
    }

    const audCol = await client.query<{ ok: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'precio_auditoria'
       ) AS ok`,
    );
    if (audCol.rows[0]?.ok) {
      await client.query(
        `INSERT INTO precio_auditoria (
           evento_id, tabla_afectada, campo_modificado,
           valor_anterior, valor_nuevo, justificacion, usuario_id
         )
         VALUES ($1, 'precio_evento', 'estado', $2, 'cerrado', $3, $4)`,
        [
          eventoId,
          estado,
          `Listado cerrado · ${nPl} SKUs · ${ev.nombre_evento}`,
          usuarioId ?? null,
        ],
      );
    }

    await client.query("COMMIT");
    return {
      ok: true,
      data: { ok: true, evento_id: eventoId, n_precio_lista: nPl, proveedor_id: proveedorId },
    };
  } catch (e) {
    await client.query("ROLLBACK");
    const msg = e instanceof Error ? e.message : "Error al cerrar evento";
    return { ok: false, error: msg };
  } finally {
    client.release();
  }
}
