/**
 * OT-REPORT-ROLES-Y-ESTILO-BANANA-001: Endpoint sesión actual
 */

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'

export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      )
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id_usuario: session.id_usuario,
        name: session.name,
        role: session.role,
        rol_id: session.rol_id,
        categoria: session.role, // categoria es lo mismo que role
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
