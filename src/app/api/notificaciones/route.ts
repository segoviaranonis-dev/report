import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { fetchNotificacionesUsuario } from '@/lib/notificaciones/queries'
import { TIPOS_ALERTA_CRITICA } from '@/lib/notificaciones/types'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const soloNoLeidas = searchParams.get('no_leidas') === 'true'
  const soloCriticas = searchParams.get('criticas') === 'true'

  let notificaciones = await fetchNotificacionesUsuario(session.id_usuario, soloNoLeidas)

  if (soloCriticas) {
    notificaciones = notificaciones.filter((n) => TIPOS_ALERTA_CRITICA.has(n.tipo))
  }

  return NextResponse.json({
    notificaciones,
    total: notificaciones.length,
  })
}
