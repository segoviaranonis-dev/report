import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { marcarNotificacionLeida } from '@/lib/notificaciones/queries'

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params
  const notifId = Number(id)
  if (!Number.isFinite(notifId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const ok = await marcarNotificacionLeida(session.id_usuario, notifId)
  if (!ok) {
    return NextResponse.json({ error: 'Notificación no encontrada' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
