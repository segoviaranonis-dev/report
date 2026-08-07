import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { registrarPresenciaWeb } from '@/lib/holding/bitacora-monitoreo'

export const dynamic = 'force-dynamic'

/** Ping presencia Bitácora holding (sesión Report). */
export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ ok: false }, { status: 401 })
  const r = await registrarPresenciaWeb({
    id_usuario: session.id_usuario,
    app: 'report',
    descp_usuario: session.name,
  })
  return NextResponse.json({ ok: r.ok, evento: r.evento })
}
