/**
 * OT-REPORT-ROLES-Y-ESTILO-BANANA-001: Middleware con control de acceso por rol
 * Roles:
 *  1 = Todo acceso
 *  2 = Solo Retail
 *  3 = Solo Ventas con Fotos
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

// Rutas permitidas por rol
const ROLE_ROUTES: Record<number, string[]> = {
  1: ['/', '/rimec', '/retail', '/ventas-fotos', '/aprobaciones', '/informes'],
  2: ['/retail'],
  3: ['/ventas-fotos'],
}

// APIs permitidas por rol
const ROLE_API_ROUTES: Record<number, RegExp[]> = {
  1: [/.*/], // Todo
  2: [/^\/api\/retail\//, /^\/api\/auth\//],
  3: [/^\/api\/ventas-fotos\//, /^\/api\/auth\//],
}

// Redirect por rol cuando acceden a /
const ROLE_HOME_REDIRECT: Record<number, string> = {
  1: '/', // Mantener en home
  2: '/retail',
  3: '/ventas-fotos',
}

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
    const { payload } = await jwtVerify(token, SECRET)

    const rol_id = Number(payload.rol_id) || 1

    // Si accede a /, redirigir según rol
    if (pathname === '/') {
      const homeRedirect = ROLE_HOME_REDIRECT[rol_id]
      if (homeRedirect && homeRedirect !== '/') {
        const redirectUrl = new URL(homeRedirect, request.url)
        return NextResponse.redirect(redirectUrl)
      }
    }

    // Verificar permisos de ruta
    const allowedRoutes = ROLE_ROUTES[rol_id] || []
    const hasRouteAccess = allowedRoutes.some(route => {
      if (route === '/') return pathname === '/'
      return pathname.startsWith(route)
    })

    // Verificar permisos de API
    const allowedApiPatterns = ROLE_API_ROUTES[rol_id] || []
    const isApiRoute = pathname.startsWith('/api/')
    const hasApiAccess = isApiRoute
      ? allowedApiPatterns.some(pattern => pattern.test(pathname))
      : true // No-API routes ya fueron verificadas arriba

    if (!hasRouteAccess || (isApiRoute && !hasApiAccess)) {
      // Acceso denegado → redirigir a ruta permitida
      const fallbackRoute = ROLE_HOME_REDIRECT[rol_id] || '/login'
      const redirectUrl = new URL(fallbackRoute, request.url)
      return NextResponse.redirect(redirectUrl)
    }

    // Token válido + permisos OK → permitir acceso
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
