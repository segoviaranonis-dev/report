import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getBitacoraReciente, getPpLogReciente } from '@/lib/holding/bitacora'
import { listMonitoreoUsuarios } from '@/lib/holding/bitacora-monitoreo'

/** Feed forense + monitoreo sesión/venta — solo rol_id=1 (holding admin). */
export async function GET(request: Request) {
  const session = await getSession()
  if (!session || session.rol_id !== 1) {
    return NextResponse.json({ error: 'Holding admin requerido (rol_id=1)' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit')) || 80, 200)
  const vista = searchParams.get('vista') || 'all'

  try {
    if (vista === 'monitoreo') {
      const { grupos, semana } = await listMonitoreoUsuarios()
      return NextResponse.json({ monitoreo: grupos, semana })
    }

    const [flujo, ppLog, mon] = await Promise.all([
      getBitacoraReciente(limit),
      getPpLogReciente(Math.min(limit, 50)),
      listMonitoreoUsuarios(),
    ])
    return NextResponse.json({
      flujo,
      pp_log: ppLog,
      monitoreo: mon.grupos,
      semana: mon.semana,
    })
  } catch (e) {
    console.error('[holding/bitacora]', e)
    return NextResponse.json({ error: 'Error leyendo bitácora' }, { status: 500 })
  }
}
