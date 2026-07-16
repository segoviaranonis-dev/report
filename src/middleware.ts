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
import { REPORT_SESSION_VERSION } from '@/lib/auth/constants'
import { apiAllowedForEnte, pathnameAllowedForEnte } from '@/lib/auth/ente-acceso'
import { aplicarAccesoCanonicoBzz } from '@/lib/auth/bzz-acceso'
import {
  CAJA_RIMEC_HOME,
  cajaRimecPathAllowed,
  cajaRimecShouldRedirectHome,
  isCajaRimec,
} from '@/lib/auth/caja-rimec'

function getSecret() {
  if (!process.env.REPORT_SESSION_SECRET) {
    throw new Error('REPORT_SESSION_SECRET no configurada')
  }
  return new TextEncoder().encode(process.env.REPORT_SESSION_SECRET)
}

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout', '/api/auth/me']

// Rutas permitidas por rol
const ROLE_ROUTES: Record<number, string[]> = {
  1: ['/', '/rimec', '/retail', '/ventas-fotos', '/aprobaciones', '/pilares', '/proceso-importacion', '/compra-legal', '/facturacion', '/deposito-rimec', '/depositos-bazzar', '/tablet-bazzar', '/informes', '/bazzar-web', '/rrhh', '/holding', '/herramienta-reposicion', '/stock-pronta-entrega', '/stock-transito', '/stock-programado'],
  2: ['/retail', '/depositos-bazzar', '/tablet-bazzar'],
  3: ['/ventas-fotos'],
}

// APIs permitidas por rol
const ROLE_API_ROUTES: Record<number, RegExp[]> = {
  1: [/.*/], // Todo
  2: [/^\/api\/retail\//, /^\/api\/depositos\//, /^\/api\/tablet-bazzar\//, /^\/api\/auth\//],
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

  // Legacy → ruta anidada bajo proceso importación
  if (pathname === "/motor-precios" || pathname.startsWith("/motor-precios/")) {
    const dest = pathname.replace(/^\/motor-precios/, "/proceso-importacion/motor-precios");
    return NextResponse.redirect(new URL(dest, request.url));
  }
  // Importación precios (legacy hermano) → bajo motor 2.3.1.7.1
  if (
    pathname === "/proceso-importacion/importacion-precios" ||
    pathname.startsWith("/proceso-importacion/importacion-precios/")
  ) {
    const dest = pathname.replace(
      "/proceso-importacion/importacion-precios",
      "/proceso-importacion/motor-precios/importacion-precios"
    );
    return NextResponse.redirect(new URL(dest, request.url));
  }
  // Abastecimiento mal anidado → rutas hermanas 2.3.1.8–10
  if (pathname === "/proceso-importacion/compra-legal" || pathname.startsWith("/proceso-importacion/compra-legal/")) {
    return NextResponse.redirect(new URL(pathname.replace("/proceso-importacion/compra-legal", "/compra-legal"), request.url));
  }
  if (pathname === "/proceso-importacion/facturacion" || pathname.startsWith("/proceso-importacion/facturacion/")) {
    return NextResponse.redirect(new URL(pathname.replace("/proceso-importacion/facturacion", "/facturacion"), request.url));
  }
  if (pathname === "/proceso-importacion/deposito-rimec" || pathname.startsWith("/proceso-importacion/deposito-rimec/")) {
    return NextResponse.redirect(new URL(pathname.replace("/proceso-importacion/deposito-rimec", "/deposito-rimec"), request.url));
  }

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
    // Sin sesión → redirect login (conservar destino para post-login ágil)
    const loginUrl = new URL('/login', request.url)
    if (!isApiRoute && pathname !== '/login') {
      const dest = `${pathname}${request.nextUrl.search}`
      loginUrl.searchParams.set('next', dest)
    }
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

    const rol_id_raw = Number(payload.rol_id) || 0
    const categoria = String(payload.role ?? '').toUpperCase().trim()
    const sessionName = String(payload.name ?? '')
    const bzz = aplicarAccesoCanonicoBzz(
      sessionName,
      rol_id_raw,
      payload.ente_codigo != null ? Number(payload.ente_codigo) : null,
    )
    const rol_id = bzz.rol_id
    const ente_codigo = bzz.ente_codigo

    // CAJA RIMEC: solo Facturación Pronta Entrega
    if (isCajaRimec(rol_id, categoria)) {
      if (cajaRimecShouldRedirectHome(pathname)) {
        return NextResponse.redirect(new URL(CAJA_RIMEC_HOME, request.url))
      }
      if (pathname.startsWith('/facturacion/transito')) {
        if (isApiRoute) {
          return NextResponse.json(
            { error: 'CAJA RIMEC: solo Facturación Pronta Entrega' },
            { status: 403 },
          )
        }
        return NextResponse.redirect(new URL(CAJA_RIMEC_HOME, request.url))
      }
      if (!cajaRimecPathAllowed(pathname)) {
        if (isApiRoute) {
          return NextResponse.json(
            { error: 'CAJA RIMEC: acceso denegado' },
            { status: 403 },
          )
        }
        return NextResponse.redirect(new URL(CAJA_RIMEC_HOME, request.url))
      }
      return NextResponse.next()
    }

    // Motor precio BAZZAR WEB: solo rol_id=1
    if (
      pathname.startsWith('/bazzar-web/motor-precio') ||
      pathname.startsWith('/api/bazzar-web/motor-precio') ||
      pathname.startsWith('/bazzar-web/stock-sano') ||
      pathname.startsWith('/api/bazzar-web/stock-sano')
    ) {
      if (rol_id !== 1) {
        if (isApiRoute) {
          return NextResponse.json({ error: 'RIMEC Admin requerido' }, { status: 403 })
        }
        const fallback = ROLE_HOME_REDIRECT[rol_id] || '/login'
        return NextResponse.redirect(new URL(fallback, request.url))
      }
    }

    // Compra / Depósito Web: rol 1 o rol 2 ADMIN
    if (
      pathname.startsWith('/bazzar-web/compra') ||
      pathname.startsWith('/bazzar-web/deposito-web')
    ) {
      const ok = rol_id === 1 || (rol_id === 2 && categoria === 'ADMIN')
      if (!ok) {
        if (isApiRoute) {
          return NextResponse.json({ error: 'Bazzar Admin requerido' }, { status: 403 })
        }
        const fallback = ROLE_HOME_REDIRECT[rol_id] || '/login'
        return NextResponse.redirect(new URL(fallback, request.url))
      }
    }

    // Nivel Dios: /aprobaciones y APIs del módulo
    if (pathname.startsWith('/aprobaciones') || pathname.startsWith('/api/aprobaciones')) {
      if (rol_id !== 1 || categoria !== 'DIOS') {
        if (isApiRoute) {
          return NextResponse.json(
            { error: 'Nivel Superior requerido: acceso restringido' },
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
      const fallbackRoute = ROLE_HOME_REDIRECT[rol_id] || '/login'
      const redirectUrl = new URL(fallbackRoute, request.url)
      return NextResponse.redirect(redirectUrl)
    }

    if (rol_id !== 1) {
      const enteOk = isApiRoute
        ? apiAllowedForEnte(pathname, ente_codigo, rol_id)
        : pathnameAllowedForEnte(pathname, ente_codigo, rol_id)
      if (!enteOk) {
        if (isApiRoute) {
          return NextResponse.json({ error: 'Acceso denegado para su ente' }, { status: 403 })
        }
        const fallbackRoute = ROLE_HOME_REDIRECT[rol_id] || '/login'
        return NextResponse.redirect(new URL(fallbackRoute, request.url))
      }
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
    '/tablet-bazzar/:path*',
    '/bazzar-web/:path*',
    '/rrhh/:path*',
    '/pilares/:path*',
    '/compra-legal/:path*',
    '/facturacion/:path*',
    '/deposito-rimec/:path*',
    '/holding/:path*',
    '/proceso-importacion/:path*',
    '/api/holding/:path*',
    '/api/facturacion/:path*',
    '/api/deposito-rimec/:path*',
    '/motor-precios/:path*',
    '/api/motor-precios/:path*',
    '/api/rimec/:path*',
    '/api/pilares/:path*',
    '/api/retail/:path*',
    '/api/ventas-fotos/:path*',
    '/api/aprobaciones/:path*',
    '/api/depositos/:path*',
    '/api/tablet-bazzar/:path*',
    '/api/bazzar-web/:path*',
    '/api/rrhh/:path*',
    '/herramienta-reposicion',
    '/herramienta-reposicion/:path*',
    '/api/herramienta-reposicion',
    '/api/herramienta-reposicion/:path*',
  ],
}
