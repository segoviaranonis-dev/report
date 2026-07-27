import { getRimecPool } from '@/lib/rimec/pool'
import type { NotificacionRow } from './types'

export async function fetchNotificacionesUsuario(
  idUsuario: number,
  soloNoLeidas: boolean,
): Promise<NotificacionRow[]> {
  const pool = getRimecPool()
  const { rows } = await pool.query<NotificacionRow>(
    soloNoLeidas
      ? `SELECT id, usuario_id, tipo, titulo, mensaje, entidad_tipo, entidad_id,
                deep_link, leida, created_at::text
         FROM notificaciones
         WHERE usuario_id = $1 AND leida = false
         ORDER BY created_at DESC
         LIMIT 20`
      : `SELECT id, usuario_id, tipo, titulo, mensaje, entidad_tipo, entidad_id,
                deep_link, leida, created_at::text
         FROM notificaciones
         WHERE usuario_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
    [idUsuario],
  )
  return rows
}

export async function marcarNotificacionLeida(
  idUsuario: number,
  notifId: number,
): Promise<boolean> {
  const pool = getRimecPool()
  const { rowCount } = await pool.query(
    `UPDATE notificaciones SET leida = true
     WHERE id = $1 AND usuario_id = $2`,
    [notifId, idUsuario],
  )
  return (rowCount ?? 0) > 0
}
