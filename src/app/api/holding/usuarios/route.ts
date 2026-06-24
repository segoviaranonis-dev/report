import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { listUsuariosHolding, setUsuarioBloqueado } from '@/lib/holding/bitacora'

export async function GET() {
  const session = await getSession()
  if (!session || session.rol_id !== 1) {
    return NextResponse.json({ error: 'Holding admin requerido' }, { status: 403 })
  }
  try {
    const usuarios = await listUsuariosHolding()
    return NextResponse.json({ usuarios })
  } catch (e) {
    console.error('[holding/usuarios GET]', e)
    return NextResponse.json({ error: 'Error listando usuarios' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session || session.rol_id !== 1) {
    return NextResponse.json({ error: 'Holding admin requerido' }, { status: 403 })
  }

  const body = await request.json()
  const idUsuario = Number(body.id_usuario)
  const bloquear = Boolean(body.bloquear)
  const motivo = String(body.motivo || '').trim()

  if (!idUsuario) {
    return NextResponse.json({ error: 'id_usuario requerido' }, { status: 400 })
  }
  if (bloquear && !motivo) {
    return NextResponse.json({ error: 'motivo obligatorio al bloquear' }, { status: 400 })
  }
  if (idUsuario === session.id_usuario && bloquear) {
    return NextResponse.json({ error: 'No puede bloquearse a sí mismo' }, { status: 400 })
  }

  try {
    await setUsuarioBloqueado(idUsuario, bloquear, motivo || null, session.id_usuario)
    return NextResponse.json({ ok: true, bloqueado: bloquear })
  } catch (e) {
    console.error('[holding/usuarios POST]', e)
    return NextResponse.json({ error: 'Error actualizando usuario' }, { status: 500 })
  }
}
