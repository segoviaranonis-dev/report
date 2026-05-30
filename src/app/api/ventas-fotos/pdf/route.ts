import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/pdf/rateLimit'
import { generarPDFVentasFotos, type PDFVentasFotosData } from '@/lib/ventas-fotos/pdfGenerator'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Vercel Pro: 60 segundos timeout

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
    let body: PDFVentasFotosData
    try {
      body = await req.json()
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

    // 3. Validaciones
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
    let pdfBuffer
    try {
      pdfBuffer = await generarPDFVentasFotos(body)
      console.log('[API Ventas-Fotos PDF] PDF generado exitosamente')
    } catch (pdfError) {
      console.error('[API Ventas-Fotos PDF] Error en generarPDFVentasFotos:', pdfError)
      return NextResponse.json(
        {
          error: 'Error al generar el PDF',
          message: pdfError instanceof Error ? pdfError.message : String(pdfError),
          stack: pdfError instanceof Error ? pdfError.stack : undefined
        },
        { status: 500 }
      )
    }

    // 5. Responder con PDF
    const nombreArchivo = `ventas-fotos-${body.cliente.id}-${body.marca.descp_marca.replace(/\s+/g, '_')}-${body.filtros.fechaInicio}-${body.filtros.fechaFin}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    console.error('[API Ventas-Fotos PDF] Error generando PDF:', error)
    console.error('[API Ventas-Fotos PDF] Error stack:', error instanceof Error ? error.stack : 'No stack')
    console.error('[API Ventas-Fotos PDF] Error message:', error instanceof Error ? error.message : String(error))

    return NextResponse.json(
      {
        error: 'Error interno al generar el PDF',
        message: error instanceof Error ? error.message : String(error),
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
