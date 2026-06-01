/**
 * OT-REPORT-AUTH-URGENTE-001: Middleware de autenticación
 * Protege todas las rutas excepto /login y /api/auth/*
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

function getSecret() {
  if (!process.env.REPORT_SESSION_SECRET) {
    throw new Error('REPORT_SESSION_SECRET no configurada')
  }
  return new TextEncoder().encode(process.env.REPORT_SESSION_SECRET)
}

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rutas públicas
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Verificar sesión
  const token = request.cookies.get('report_session')?.value

  if (!token) {
    // Sin sesión → redirect login
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  try {
    const SECRET = getSecret()
    // Verificar token válido
    await jwtVerify(token, SECRET)

    // Token válido → permitir acceso
    return NextResponse.next()
  } catch {
    // Token inválido → redirect login
    const loginUrl = new URL('/login', request.url)
    const response = NextResponse.redirect(loginUrl)
    response.cookies.delete('report_session')
    return response
  }
}

export const config = {
  matcher: [
    '/',
    '/rimec/:path*',
    '/retail/:path*',
    '/ventas-fotos/:path*',
    '/informes/:path*',
    '/aprobaciones/:path*',
    '/api/rimec/:path*',
    '/api/retail/:path*',
    '/api/ventas-fotos/:path*',
    '/api/aprobaciones/:path*',
  ],
}
