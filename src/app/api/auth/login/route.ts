/**
 * OT-REPORT-AUTH-URGENTE-001: API route login
 */

import { NextResponse } from 'next/server'
import { validateUsuario } from '@/lib/auth/validateUsuario'
import { createSession } from '@/lib/auth/session'

export async function POST(request: Request) {
  try {
    const { usuario, password } = await request.json()

    const user = await validateUsuario(usuario, password)

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      )
    }

    // Crear sesión
    await createSession({
      id_usuario: user.id_usuario,
      name: user.descp_usuario,
      role: user.categoria,
    })

    return NextResponse.json({
      success: true,
      user: {
        name: user.descp_usuario,
        role: user.categoria,
      },
    })
  } catch (error) {
    console.error('[API /auth/login] Error:', error)
    return NextResponse.json(
      { error: 'Error en el servidor' },
      { status: 500 }
    )
  }
}
