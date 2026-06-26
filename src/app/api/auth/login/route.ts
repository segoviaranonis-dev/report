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

    // Crear sesión (incluye rol_id)
    await createSession({
      id_usuario: user.id_usuario,
      name: user.descp_usuario,
      role: user.categoria,
      rol_id: user.rol_id,
      ente_id: user.ente_id,
      ente_codigo: user.ente_codigo,
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
