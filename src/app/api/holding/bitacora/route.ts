import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getBitacoraReciente, getPpLogReciente } from '@/lib/holding/bitacora'

/** Feed forense — solo rol_id=1 (holding admin). */
export async function GET(request: Request) {
  const session = await getSession()
  if (!session || session.rol_id !== 1) {
    return NextResponse.json({ error: 'Holding admin requerido (rol_id=1)' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit')) || 80, 200)

  try {
    const [flujo, ppLog] = await Promise.all([
      getBitacoraReciente(limit),
      getPpLogReciente(Math.min(limit, 50)),
    ])
    return NextResponse.json({ flujo, pp_log: ppLog })
  } catch (e) {
    console.error('[holding/bitacora]', e)
    return NextResponse.json({ error: 'Error leyendo bitácora' }, { status: 500 })
  }
}
