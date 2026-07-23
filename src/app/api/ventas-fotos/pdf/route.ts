import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/pdf/rateLimit'
import { getRimecPool, isRimecDatabaseConfigured } from '@/lib/rimec/pool'
import { fetchVentasFotos } from '@/lib/ventas-fotos/queries'
import { generarPDFVentasFotos, type PDFVentasFotosData } from '@/lib/ventas-fotos/pdfGenerator'
import type { VentasFotosFilters } from '@/lib/ventas-fotos/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // Vercel Pro: PDF hasta 80 filas + precarga imágenes
export const runtime = 'nodejs'

/** Headers HTTP solo aceptan Latin-1; Vercel/Node falla con Unicode (ej. … U+2026). */
function toAsciiHeader(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, (ch) => (ch === '…' ? '...' : '?'))
}

type PdfRequestBody =
  | PDFVentasFotosData
  | { source: 'filters'; filters: VentasFotosFilters }

function isFiltersRequest(body: unknown): body is { source: 'filters'; filters: VentasFotosFilters } {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as { source?: string }).source === 'filters' &&
    typeof (body as { filters?: unknown }).filters === 'object' &&
    (body as { filters?: unknown }).filters !== null
  )
}

async function resolvePdfData(body: PdfRequestBody): Promise<PDFVentasFotosData | { error: string; status: number }> {
  if (isFiltersRequest(body)) {
    if (!isRimecDatabaseConfigured()) {
      return { error: 'DATABASE_URL no configurada', status: 503 }
    }
    const f = body.filters
    if (!f.clienteCodigo || !f.fechaInicio || !f.fechaFin || !f.marcaId) {
      return { error: 'Filtros incompletos para generar PDF', status: 400 }
    }
    const data = await fetchVentasFotos(getRimecPool(), f)
    if (!data.rows.length) {
      return { error: 'Sin filas para el PDF con esos filtros', status: 400 }
    }
    if (!data.cliente || !data.marca) {
      return { error: 'No se pudo resolver cliente o marca', status: 400 }
    }
    return {
      cliente: data.cliente,
      marca: data.marca,
      filtros: { fechaInicio: f.fechaInicio, fechaFin: f.fechaFin },
      kpis: data.kpis,
      pillarStats: data.pillarStats,
      rows: data.rows,
    }
  }
  return body as PDFVentasFotosData
}

export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limiting (por IP ya que report no tiene auth)
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const identifier = `pdf-ventas-fotos:${ip}`
    const rateLimit = await checkRateLimit(identifier)

    if (!rateLimit.success) {
      console.warn('[PDF Ventas-Fotos] Rate limit excedido para IP:', ip)
      return NextResponse.json(
        {
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Demasiadas solicitudes. Por favor espera un momento antes de generar otro PDF.',
          retryAfter: Math.ceil((rateLimit.reset - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(rateLimit.limit),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'X-RateLimit-Reset': String(rateLimit.reset),
          },
        }
      )
    }

    // 2. Parsear body
    let rawBody: PdfRequestBody
    try {
      rawBody = await req.json()
    } catch (parseError) {
      console.error('[API Ventas-Fotos PDF] Error parseando JSON:', parseError)
      return NextResponse.json(
        {
          error: 'Error parseando el request',
          message: parseError instanceof Error ? parseError.message : 'JSON inválido'
        },
        { status: 400 }
      )
    }

    const resolved = await resolvePdfData(rawBody)
    if ('error' in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    }
    const body = resolved
    console.log('[API Ventas-Fotos PDF] Request recibido')
    console.log('[API Ventas-Fotos PDF] Filas recibidas:', body.rows?.length || 0)
    console.log('[API Ventas-Fotos PDF] Cliente:', body.cliente?.nombre)
    console.log('[API Ventas-Fotos PDF] Marca:', body.marca?.descp_marca)

    if (!body.rows || !Array.isArray(body.rows) || body.rows.length === 0) {
      console.error('[API Ventas-Fotos PDF] Error: No hay filas')
      return NextResponse.json(
        { error: 'No se recibieron filas para el PDF' },
        { status: 400 }
      )
    }

    if (!body.cliente || !body.marca) {
      console.error('[API Ventas-Fotos PDF] Error: Faltan datos del cliente o marca')
      return NextResponse.json(
        { error: 'Faltan datos del cliente o marca' },
        { status: 400 }
      )
    }

    if (!body.filtros || !body.filtros.fechaInicio || !body.filtros.fechaFin) {
      console.error('[API Ventas-Fotos PDF] Error: Faltan filtros de fecha')
      return NextResponse.json(
        { error: 'Faltan filtros de fecha' },
        { status: 400 }
      )
    }

    if (!body.kpis) {
      console.error('[API Ventas-Fotos PDF] Error: Faltan KPIs')
      return NextResponse.json(
        { error: 'Faltan KPIs' },
        { status: 400 }
      )
    }

    // Log solo en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log('[API Ventas-Fotos PDF] Generando PDF para:', body.cliente.nombre)
      console.log('[API Ventas-Fotos PDF] Filas:', body.rows.length)
    }

    // 4. Generar PDF
    console.log('[API Ventas-Fotos PDF] Iniciando generación de PDF...')
    let pdfResult: Awaited<ReturnType<typeof generarPDFVentasFotos>>
    try {
      pdfResult = await generarPDFVentasFotos(body)
      console.log('[API Ventas-Fotos PDF] PDF generado exitosamente')
    } catch (pdfError) {
      console.error('[API Ventas-Fotos PDF] Error en generarPDFVentasFotos:', pdfError)
      const message = pdfError instanceof Error ? pdfError.message : String(pdfError)
      const status = message.startsWith('PDF abortado') ? 422 : 500
      return NextResponse.json(
        {
          error: message,
          message,
          stack: pdfError instanceof Error ? pdfError.stack : undefined
        },
        { status }
      )
    }

    // 5. Responder con PDF
    const nombreArchivo = `ventas-fotos-${body.cliente.id}-${(body.marca.descp_marca ?? 'marca').replace(/[^\w.-]+/g, '_')}-${body.filtros.fechaInicio}-${body.filtros.fechaFin}.pdf`
    const missingPreview = pdfResult.missingInStorage.slice(0, 8).join(', ')
    const headers: Record<string, string> = {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Expose-Headers': 'X-PDF-Missing-Images, X-PDF-Missing-Count',
    }
    if (pdfResult.missingInStorage.length > 0) {
      headers['X-PDF-Missing-Count'] = String(pdfResult.missingInStorage.length)
      const suffix = pdfResult.missingInStorage.length > 8 ? '...' : ''
      headers['X-PDF-Missing-Images'] = toAsciiHeader(missingPreview + suffix)
    }

    return new NextResponse(new Uint8Array(pdfResult.buffer), {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error('[API Ventas-Fotos PDF] Error generando PDF:', error)
    console.error('[API Ventas-Fotos PDF] Error stack:', error instanceof Error ? error.stack : 'No stack')
    console.error('[API Ventas-Fotos PDF] Error message:', error instanceof Error ? error.message : String(error))

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
        message: error instanceof Error ? error.message : String(error),
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
