/**
 * OT-REPORT-ROLES-Y-ESTILO-BANANA-001: Endpoint sesión actual
 */

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { aplicarAccesoCanonicoBzz } from '@/lib/auth/bzz-acceso'

export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      )
    }

    const bzz = aplicarAccesoCanonicoBzz(
      session.name,
      session.rol_id,
      session.ente_codigo ?? null,
    )

    return NextResponse.json({
      authenticated: true,
      user: {
        id_usuario: session.id_usuario,
        name: session.name,
        role: session.role,
        rol_id: bzz.rol_id,
        categoria: session.role,
        ente_id: session.ente_id ?? null,
        ente_codigo: bzz.ente_codigo,
      },
    })
  } catch (error) {
    console.error('[API /auth/me] Error:', error)
    return NextResponse.json(
      { authenticated: false },
      { status: 500 }
    )
  }
}
