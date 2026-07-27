export type NotificacionRow = {
  id: number
  usuario_id: number
  tipo: string
  titulo: string
  mensaje: string
  entidad_tipo: string | null
  entidad_id: number | null
  deep_link: string | null
  leida: boolean
  created_at: string
}

/** Tipos que muestran modal bloqueante hasta cerrar o Ingresar. */
export const TIPOS_ALERTA_CRITICA = new Set(['APROBACION_PENDIENTE'])

export function deepLinkNotificacion(n: NotificacionRow): string {
  if (n.deep_link?.trim()) return n.deep_link.trim()
  if (n.tipo === 'APROBACION_PENDIENTE') return '/aprobaciones?tab=pendientes'
  return '/'
}
