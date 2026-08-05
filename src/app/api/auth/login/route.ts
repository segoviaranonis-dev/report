/**
 * OT-REPORT-AUTH-URGENTE-001: API route login
 */

import { NextResponse } from 'next/server'
import { validateUsuario } from '@/lib/auth/validateUsuario'
import { createSession } from '@/lib/auth/session'
import { CAJA_RIMEC_HOME, isCajaRimec } from '@/lib/auth/caja-rimec'
import {
  JEFE_DEPOSITO_HOME,
  isJefeDepositoRimec,
} from '@/lib/auth/jefe-deposito-rimec'
import {
  VENDEDOR_RIMEC_HOME,
  isVendedorRimecReport,
} from '@/lib/auth/vendedor-rimec-report'
import {
  isRimecDbUnreachableError,
  mensajeRimecDbOffline,
} from '@/lib/rimec/pool'

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

    // Home: VENDEDOR → solo ventas-fotos. Bazzar (2) → /retail vía middleware.
    const home = isCajaRimec(user.rol_id, user.categoria)
      ? CAJA_RIMEC_HOME
      : isJefeDepositoRimec(user.rol_id, user.categoria)
        ? JEFE_DEPOSITO_HOME
        : isVendedorRimecReport(user.rol_id, user.categoria)
          ? VENDEDOR_RIMEC_HOME
          : user.rol_id === 2
            ? "/retail"
            : '/'

    return NextResponse.json({
      success: true,
      home,
      user: {
        name: user.descp_usuario,
        role: user.categoria,
        rol_id: user.rol_id,
      },
    })
  } catch (error) {
    console.error('[API /auth/login] Error:', error)
    if (isRimecDbUnreachableError(error)) {
      return NextResponse.json(
        {
          error:
            'Base de datos no disponible (Supabase). No se puede validar la contraseña. Avisá a sistemas.',
          detail: mensajeRimecDbOffline(error),
          code: 'DB_UNREACHABLE',
        },
        { status: 503 },
      )
    }
    return NextResponse.json(
      { error: 'Error en el servidor' },
      { status: 500 }
    )
  }
}
