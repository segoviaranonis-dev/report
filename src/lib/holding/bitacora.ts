import { getRimecPool, isRimecDatabaseConfigured } from '@/lib/rimec/pool'

export type BitacoraRow = {
  id: number
  entidad: string
  entidad_id: number
  nro_registro: string | null
  accion: string
  estado_antes: string | null
  estado_despues: string | null
  usuario_id: number | null
  descp_usuario: string | null
  created_at: string
}

export type PpLogRow = {
  id: number
  pp_id: number
  estado_anterior: string | null
  estado_nuevo: string
  usuario_id: number | null
  descp_usuario: string | null
  compra_legal_id: number | null
  observaciones: string | null
  timestamp: string
}

export type UsuarioHoldingRow = {
  id_usuario: number
  descp_usuario: string
  categoria: string
  rol_id: number
  bloqueado: boolean
  bloqueado_motivo: string | null
  bloqueado_at: string | null
}

export async function getBitacoraReciente(limit = 80): Promise<BitacoraRow[]> {
  if (!isRimecDatabaseConfigured()) return []
  const pool = getRimecPool()
  const { rows } = await pool.query<BitacoraRow>(`
    SELECT fa.id, fa.entidad, fa.entidad_id, fa.nro_registro, fa.accion,
           fa.estado_antes, fa.estado_despues, fa.usuario_id,
           u.descp_usuario, fa.created_at::text
    FROM flujo_auditoria fa
    LEFT JOIN usuario_v2 u ON u.id_usuario = fa.usuario_id
    ORDER BY fa.created_at DESC
    LIMIT $1
  `, [limit])
  return rows
}

export async function getPpLogReciente(limit = 40): Promise<PpLogRow[]> {
  if (!isRimecDatabaseConfigured()) return []
  const pool = getRimecPool()
  const { rows } = await pool.query<PpLogRow>(`
    SELECT ppl.id, ppl.pp_id, ppl.estado_anterior, ppl.estado_nuevo,
           ppl.usuario_id, u.descp_usuario, ppl.compra_legal_id,
           ppl.observaciones, ppl.timestamp::text
    FROM pedido_proveedor_log ppl
    LEFT JOIN usuario_v2 u ON u.id_usuario = ppl.usuario_id
    ORDER BY ppl.timestamp DESC
    LIMIT $1
  `, [limit])
  return rows
}

export async function listUsuariosHolding(): Promise<UsuarioHoldingRow[]> {
  if (!isRimecDatabaseConfigured()) return []
  const pool = getRimecPool()
  const { rows } = await pool.query<UsuarioHoldingRow>(`
    SELECT id_usuario, descp_usuario, categoria, rol_id,
           COALESCE(bloqueado, false) AS bloqueado,
           bloqueado_motivo, bloqueado_at::text
    FROM usuario_v2
    ORDER BY descp_usuario
  `)
  return rows
}

export async function setUsuarioBloqueado(
  idUsuario: number,
  bloquear: boolean,
  motivo: string | null,
  ejecutorId: number,
): Promise<void> {
  const pool = getRimecPool()
  await pool.query('BEGIN')
  try {
    await pool.query(
      `
      UPDATE usuario_v2
      SET bloqueado = $1,
          bloqueado_motivo = CASE WHEN $1 THEN $2 ELSE NULL END,
          bloqueado_at = CASE WHEN $1 THEN now() ELSE NULL END,
          bloqueado_por = CASE WHEN $1 THEN $3 ELSE NULL END
      WHERE id_usuario = $4
      `,
      [bloquear, (motivo || '').trim() || null, ejecutorId, idUsuario],
    )
    await pool.query(
      `
      INSERT INTO flujo_auditoria
        (entidad, entidad_id, accion, estado_antes, estado_despues, snap, usuario_id)
      VALUES
        ('USUARIO', $1, $2, $3, $4, $5::jsonb, $6)
      `,
      [
        idUsuario,
        bloquear ? 'USUARIO_BLOQUEADO' : 'USUARIO_DESBLOQUEADO',
        bloquear ? 'ACTIVO' : 'BLOQUEADO',
        bloquear ? 'BLOQUEADO' : 'ACTIVO',
        JSON.stringify({ motivo, ejecutor_id: ejecutorId }),
        ejecutorId,
      ],
    )
    await pool.query('COMMIT')
  } catch (e) {
    await pool.query('ROLLBACK')
    throw e
  }
}
