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

/** Borra IC sin puente PP — PENDIENTE_OPERATIVO o AUTORIZADO (bandeja / digitación). */
export async function eliminarIc(pool: Pool, icId: number): Promise<{ ok: boolean; error?: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const icRes = await client.query<{ estado: string }>(
      `SELECT estado FROM intencion_compra WHERE id = $1 FOR UPDATE`,
      [icId],
    );
    const ic = icRes.rows[0];
    if (!ic) {
      await client.query("ROLLBACK");
      return { ok: false, error: "IC no encontrada." };
    }
    if (ic.estado !== "PENDIENTE_OPERATIVO" && ic.estado !== "AUTORIZADO") {
      await client.query("ROLLBACK");
      return { ok: false, error: "Solo se eliminan IC pendientes o autorizadas sin PP." };
    }

    const pp = await client.query(
      `SELECT 1 FROM intencion_compra_pedido WHERE intencion_compra_id = $1`,
      [icId],
    );
    if (pp.rowCount) {
      await client.query("ROLLBACK");
      return { ok: false, error: "IC ya tiene puente PP — no se puede eliminar." };
    }

    await client.query(`DELETE FROM intencion_compra WHERE id = $1`, [icId]);
    await client.query("COMMIT");
    return { ok: true };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
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
