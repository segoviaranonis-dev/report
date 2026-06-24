import type { Pool } from "pg";

export async function autorizarIc(pool: Pool, icId: number): Promise<{ ok: boolean; error?: string }> {
  const { rowCount } = await pool.query(
    `UPDATE intencion_compra SET estado = 'AUTORIZADO'
     WHERE id = $1 AND estado = 'PENDIENTE_OPERATIVO'`,
    [icId],
  );
  if (!rowCount) return { ok: false, error: "La IC no está PENDIENTE_OPERATIVO o no existe." };
  return { ok: true };
}

export async function eliminarIc(pool: Pool, icId: number): Promise<{ ok: boolean; error?: string }> {
  const { rowCount } = await pool.query(
    `DELETE FROM intencion_compra WHERE id = $1 AND estado = 'PENDIENTE_OPERATIVO'`,
    [icId],
  );
  if (!rowCount) return { ok: false, error: "Solo se eliminan IC pendientes." };
  return { ok: true };
}

export async function reautorizarIc(pool: Pool, icId: number): Promise<{ ok: boolean; error?: string }> {
  const { rowCount } = await pool.query(
    `UPDATE intencion_compra SET estado = 'AUTORIZADO'
     WHERE id = $1 AND estado = 'DEVUELTO_ADMIN'`,
    [icId],
  );
  if (!rowCount) return { ok: false, error: "IC no está DEVUELTO_ADMIN." };
  return { ok: true };
}

export async function anularIc(pool: Pool, icId: number): Promise<{ ok: boolean; error?: string }> {
  const { rowCount } = await pool.query(
    `UPDATE intencion_compra SET estado = 'ANULADO'
     WHERE id = $1 AND estado = 'DEVUELTO_ADMIN'`,
    [icId],
  );
  if (!rowCount) return { ok: false, error: "Solo se anulan IC devueltas." };
  return { ok: true };
}
