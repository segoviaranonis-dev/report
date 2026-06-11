/**
 * OT-REPORT-ROLES-Y-ESTILO-BANANA-001: Middleware con control de acceso por rol
 *
 * Report (login): cualquier usuario válido en usuario_v2.
 * rol_id 1 → todos los módulos de Report.
 * rol_id 2 → Bazzar (retail, depósitos, tablet según categoría).
 * rol_id 3 → ventas-fotos.
 *
 * Excepción única: /aprobaciones → rol_id=1 Y categoria=DIOS (Nivel Dios).
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const REPORT_SESSION_VERSION = 2

function getSecret() {
  if (!process.env.REPORT_SESSION_SECRET) {
    throw new Error('REPORT_SESSION_SECRET no configurada')
  }
  return new TextEncoder().encode(process.env.REPORT_SESSION_SECRET)
}

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout', '/api/auth/me']

// Rutas permitidas por rol
const ROLE_ROUTES: Record<number, string[]> = {
  1: ['/', '/rimec', '/retail', '/ventas-fotos', '/aprobaciones', '/depositos-bazzar', '/informes'],
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
  const isApiRoute = pathname.startsWith('/api/')

  // Rutas públicas
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Verificar sesión
  const token = request.cookies.get('report_session')?.value

  if (!token) {
    if (isApiRoute) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    // Sin sesión → redirect login
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  try {
    const SECRET = getSecret()
    const { payload } = await jwtVerify(token, SECRET)

    if (payload.session_version !== REPORT_SESSION_VERSION) {
      const loginUrl = new URL('/login', request.url)
      const response = isApiRoute
        ? NextResponse.json({ error: 'Sesión vencida' }, { status: 401 })
        : NextResponse.redirect(loginUrl)
      response.cookies.delete('report_session')
      return response
    }

    const rol_id = Number(payload.rol_id) || 0
    const categoria = String(payload.role ?? '').toUpperCase().trim()

    // Nivel Dios: /aprobaciones solo rol_id=1 + categoria=DIOS (usuario_v2)
    if (pathname.startsWith('/aprobaciones')) {
      if (rol_id !== 1 || categoria !== 'DIOS') {
        if (isApiRoute) {
          return NextResponse.json(
            { error: 'Nivel Dios requerido: rol_id=1 y categoria=DIOS' },
            { status: 403 },
          )
        }
        const homeUrl = new URL('/', request.url)
        homeUrl.searchParams.set('aprobaciones', 'denegado')
        return NextResponse.redirect(homeUrl)
      }
    }

    // Si accede a /, redirigir según rol
    if (pathname === '/') {
      const homeRedirect = ROLE_HOME_REDIRECT[rol_id]
      if (homeRedirect && homeRedirect !== '/') {
        const redirectUrl = new URL(homeRedirect, request.url)
        return NextResponse.redirect(redirectUrl)
      }
    }

    // Verificar permisos de API
    const allowedApiPatterns = ROLE_API_ROUTES[rol_id] || []
    const hasApiAccess = isApiRoute
      ? allowedApiPatterns.some(pattern => pattern.test(pathname))
      : true

    // Verificar permisos de pantalla solo para rutas no-API.
    const allowedRoutes = ROLE_ROUTES[rol_id] || []
    const hasRouteAccess = isApiRoute || allowedRoutes.some(route => {
      if (route === '/') return pathname === '/'
      return pathname.startsWith(route)
    })

    if (!hasRouteAccess || (isApiRoute && !hasApiAccess)) {
      if (isApiRoute) {
        return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
      }
      // Acceso denegado → redirigir a ruta permitida
      const fallbackRoute = ROLE_HOME_REDIRECT[rol_id] || '/login'
      const redirectUrl = new URL(fallbackRoute, request.url)
      return NextResponse.redirect(redirectUrl)
    }

    // Token válido + permisos OK → permitir acceso
    return NextResponse.next()
  } catch {
    if (isApiRoute) {
      const response = NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })
      response.cookies.delete('report_session')
      return response
    }
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
    '/depositos-bazzar/:path*',
    '/api/rimec/:path*',
    '/api/retail/:path*',
    '/api/ventas-fotos/:path*',
    '/api/aprobaciones/:path*',
    '/api/depositos/:path*',
  ],
}
