/**
 * Generador de PDF para Ventas con Fotos.
 *
 * Página 1: ejecutiva (estadísticas por pilares: género, estilo, tipo_1, color).
 * Páginas siguientes: detalle con fotos (sin columna técnica de pilares L-R-M-C).
 *
 * Paleta sobria (estilo Banana Republic): negro/grafito + neutros cálidos.
 * No usa azul/oro Nexus.
 */

import { PDFDocument, type PDFFont, type PDFImage, type PDFPage, StandardFonts, rgb } from 'pdf-lib'
import {
  detectDeviceType,
  safeFetchImageGarantizado,
  ImageLoadError,
  isIOSDevice,
  getRecommendedImageLimit,
  getConcurrencyLimit,
} from '../pdf/imageUrlValidator'
import { productImageCandidatesForRow } from '../retail/product-image'
import { getImagenCandidatesFlatFirst, mergeImageCandidatesFlatFirst } from './parse-imagen'
import type { PillarBucket, VentaFotoRow, VentasFotosKpis, VentasFotosMarca, VentasFotosPillarStats } from './types'

// ─── Paleta ──────────────────────────────────────────────────────────────────
const INK = rgb(0.000, 0.169, 0.306)         // #002B4E
const INK_SOFT = rgb(0.000, 0.239, 0.420)    // #003d6b
const INK_MUTED = rgb(0.510, 0.494, 0.471)   // #827d78
const RULE = rgb(0.839, 0.827, 0.808)        // #d6d3d1
const RULE_SOFT = rgb(0.910, 0.902, 0.886)   // #e8e6e1
const PAPER_ALT = rgb(0.976, 0.969, 0.957)   // #f9f7f4
const WHITE = rgb(1, 1, 1)

// Política de gráficos: azul / verde / gris (no paleta institucional).
const PALETTE = [
  rgb(0.000, 0.169, 0.306), // #002B4E anterior
  rgb(0.133, 0.773, 0.369), // #22C55E actual
  rgb(0.580, 0.639, 0.722), // #94A3B8 referencia
]

function colorAt(i: number) {
  return PALETTE[i % PALETTE.length]
}

// ─── Formateadores ───────────────────────────────────────────────────────────
const fmtInt = new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 })
const fmtMoney = new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', minimumFractionDigits: 0 })
const fmtPct = new Intl.NumberFormat('es-PY', { maximumFractionDigits: 1, minimumFractionDigits: 1 })

// ─── Tipos ───────────────────────────────────────────────────────────────────
export interface PDFVentasFotosData {
  cliente: { id: string; nombre: string }
  marca: VentasFotosMarca
  filtros: { fechaInicio: string; fechaFin: string }
  kpis: VentasFotosKpis
  pillarStats?: VentasFotosPillarStats
  rows: VentaFotoRow[]
}

interface Fonts {
  serif: PDFFont
  serifBold: PDFFont
  sans: PDFFont
  sansBold: PDFFont
}

// Constantes de página A4.
const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 40

// ─── Helpers de texto ────────────────────────────────────────────────────────
function text(
  page: PDFPage,
  s: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color = INK,
) {
  page.drawText(sanitize(s), { x, y, size, font, color })
}

function textRight(
  page: PDFPage,
  s: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color = INK,
) {
  const safe = sanitize(s)
  const w = font.widthOfTextAtSize(safe, size)
  page.drawText(safe, { x: x - w, y, size, font, color })
}

function textCenter(
  page: PDFPage,
  s: string,
  cx: number,
  y: number,
  size: number,
  font: PDFFont,
  color = INK,
) {
  const safe = sanitize(s)
  const w = font.widthOfTextAtSize(safe, size)
  page.drawText(safe, { x: cx - w / 2, y, size, font, color })
}

function ruleLine(page: PDFPage, x1: number, x2: number, y: number, color = RULE, thickness = 0.5) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, color, thickness })
}

// Normaliza caracteres que las fuentes estándar (WinAnsi) no soportan.
function sanitize(s: string): string {
  return String(s ?? '')
    .replace(/[\u2192\u279C\u27A1]/g, '->')   // flechas
    .replace(/[\u2026]/g, '...')               // ellipsis
    .replace(/[\u2022\u00B7]/g, '·' === '·' ? '\u00B7' : '-') // middle dot ya es 0xB7, queda
    .replace(/[\u2013\u2014]/g, '-')           // en/em dash
    .replace(/[\u2018\u2019]/g, "'")          // comillas tipográficas
    .replace(/[\u201C\u201D]/g, '"')
}

function widthOf(s: string, font: PDFFont, size: number): number {
  return font.widthOfTextAtSize(sanitize(s), size)
}

function truncate(s: string, max: number, font: PDFFont, size: number) {
  const safe = sanitize(s)
  if (font.widthOfTextAtSize(safe, size) <= max) return safe
  let lo = 0
  let hi = safe.length
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    const candidate = safe.slice(0, mid) + '...'
    if (font.widthOfTextAtSize(candidate, size) <= max) lo = mid
    else hi = mid - 1
  }
  return safe.slice(0, lo) + '...'
}

// ─── Página 1: ejecutiva ─────────────────────────────────────────────────────
function drawHeader(page: PDFPage, fonts: Fonts, data: PDFVentasFotosData) {
  const top = PAGE_H - MARGIN

  // Título grande serif (estilo editorial).
  text(page, 'Informe de ventas con fotos', MARGIN, top - 6, 24, fonts.serifBold, INK)

  // Sello pequeño a la derecha.
  textRight(page, 'REPORT · RIMEC', PAGE_W - MARGIN, top - 2, 8, fonts.sans, INK_MUTED)
  textRight(
    page,
    new Date().toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric' }),
    PAGE_W - MARGIN,
    top - 14,
    8,
    fonts.sans,
    INK_MUTED,
  )

  // Línea fina.
  ruleLine(page, MARGIN, PAGE_W - MARGIN, top - 22, INK, 0.7)

  // Contexto.
  const ctxY = top - 38
  text(page, data.cliente.nombre.toUpperCase(), MARGIN, ctxY, 11, fonts.sansBold, INK)
  text(page, `Cliente ${data.cliente.id}`, MARGIN, ctxY - 12, 9, fonts.sans, INK_SOFT)

  textRight(page, `Marca · ${data.marca.descp_marca}`, PAGE_W - MARGIN, ctxY, 10, fonts.sansBold, INK)
  textRight(
    page,
    `${data.filtros.fechaInicio}  →  ${data.filtros.fechaFin}  ·  CALZADOS`,
    PAGE_W - MARGIN,
    ctxY - 12,
    9,
    fonts.sans,
    INK_SOFT,
  )
}

function drawResumen(page: PDFPage, fonts: Fonts, y: number, stats: VentasFotosPillarStats): number {
  const left = MARGIN
  const right = PAGE_W - MARGIN
  const w = right - left
  const h = 56

  page.drawRectangle({ x: left, y: y - h, width: w, height: h, color: PAPER_ALT })
  page.drawRectangle({ x: left, y: y - h, width: w, height: h, borderColor: RULE_SOFT, borderWidth: 0.5 })

  const cellW = w / 3
  const cells: Array<[string, string]> = [
    ['Total pares', fmtInt.format(stats.resumen.totalPares)],
    ['Monto', fmtMoney.format(stats.resumen.totalMonto)],
    ['Artículos únicos', fmtInt.format(stats.resumen.articulosUnicos)],
  ]

  cells.forEach(([label, value], i) => {
    const cx = left + cellW * (i + 0.5)
    text(page, label.toUpperCase(), cx - cellW / 2 + 12, y - 16, 7.5, fonts.sansBold, INK_MUTED)
    textCenter(page, value, cx, y - 38, 17, fonts.serifBold, INK)
  })

  // Separadores entre celdas.
  ruleLine(page, left + cellW, left + cellW, y - h + 8, RULE_SOFT, 0.5)
  page.drawLine({
    start: { x: left + cellW, y: y - h + 8 },
    end: { x: left + cellW, y: y - 8 },
    color: RULE_SOFT,
    thickness: 0.5,
  })
  page.drawLine({
    start: { x: left + 2 * cellW, y: y - h + 8 },
    end: { x: left + 2 * cellW, y: y - 8 },
    color: RULE_SOFT,
    thickness: 0.5,
  })

  return y - h - 12
}

function sectionTitle(page: PDFPage, fonts: Fonts, y: number, title: string): number {
  text(page, title, MARGIN, y, 11, fonts.serifBold, INK)
  ruleLine(page, MARGIN, PAGE_W - MARGIN, y - 4, RULE, 0.5)
  return y - 16
}

// Donut chart con drawSvgPath. Coordenadas SVG (Y hacia abajo internamente).
function pieSlicePath(cx: number, cy: number, r: number, startRad: number, endRad: number): string {
  const x1 = cx + r * Math.cos(startRad)
  const y1 = cy + r * Math.sin(startRad)
  const x2 = cx + r * Math.cos(endRad)
  const y2 = cy + r * Math.sin(endRad)
  const largeArc = endRad - startRad > Math.PI ? 1 : 0
  // sweep=1 (sentido horario en SVG; pdf-lib invierte Y, queda visual correcto)
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
}

function drawDonutGenero(
  page: PDFPage,
  fonts: Fonts,
  x: number,
  yTop: number,
  size: number,
  buckets: PillarBucket[],
) {
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 2
  const innerR = r * 0.55

  if (!buckets.length) {
    text(page, 'Sin datos', x + 8, yTop - 20, 9, fonts.sans, INK_MUTED)
    return
  }

  const total = buckets.reduce((s, b) => s + b.pares, 0) || 1
  let acc = 0
  // Si hay un único segmento, dibujamos anillo completo.
  if (buckets.length === 1) {
    page.drawCircle({ x: x + cx, y: yTop - cy, size: r, color: colorAt(0) })
    page.drawCircle({ x: x + cx, y: yTop - cy, size: innerR, color: WHITE })
  } else {
    for (let i = 0; i < buckets.length; i++) {
      const b = buckets[i]
      const startRad = (acc / total) * Math.PI * 2 - Math.PI / 2
      acc += b.pares
      const endRad = (acc / total) * Math.PI * 2 - Math.PI / 2
      if (endRad <= startRad) continue
      const path = pieSlicePath(cx, cy, r, startRad, endRad)
      page.drawSvgPath(path, { x, y: yTop, color: colorAt(i) })
    }
    // Hueco central para donut.
    page.drawCircle({ x: x + cx, y: yTop - cy, size: innerR, color: WHITE })
  }

  // Cifra central: pares.
  textCenter(page, fmtInt.format(total), x + cx, yTop - cy - 2, 12, fonts.serifBold, INK)
  textCenter(page, 'PARES', x + cx, yTop - cy - 14, 6.5, fonts.sansBold, INK_MUTED)
}

function drawGeneroPane(
  page: PDFPage,
  fonts: Fonts,
  y: number,
  stats: VentasFotosPillarStats,
): number {
  const yStart = sectionTitle(page, fonts, y, 'Composición por género')
  const donutSize = 110
  const donutX = MARGIN
  const donutTop = yStart

  drawDonutGenero(page, fonts, donutX, donutTop, donutSize, stats.porGenero)

  // Tabla a la derecha.
  const tableX = donutX + donutSize + 18
  const tableW = PAGE_W - MARGIN - tableX
  let ty = donutTop - 4

  // Encabezado.
  const headers = ['GÉNERO', 'PARES', 'MONTO', '% PARES', '% MONTO']
  const cols = [
    { x: tableX, align: 'left' as const },
    { x: tableX + tableW * 0.40, align: 'right' as const },
    { x: tableX + tableW * 0.65, align: 'right' as const },
    { x: tableX + tableW * 0.82, align: 'right' as const },
    { x: tableX + tableW, align: 'right' as const },
  ]
  headers.forEach((h, i) => {
    const c = cols[i]
    if (c.align === 'left') text(page, h, c.x, ty, 7, fonts.sansBold, INK_MUTED)
    else textRight(page, h, c.x, ty, 7, fonts.sansBold, INK_MUTED)
  })
  ty -= 4
  ruleLine(page, tableX, tableX + tableW, ty, RULE, 0.4)
  ty -= 10

  if (!stats.porGenero.length) {
    text(page, 'Sin datos.', tableX, ty, 9, fonts.sans, INK_MUTED)
    return donutTop - donutSize - 16
  }

  stats.porGenero.forEach((b, i) => {
    // Chip de color.
    page.drawRectangle({ x: tableX, y: ty - 1, width: 6, height: 6, color: colorAt(i) })
    text(page, truncate(b.label, tableW * 0.36 - 12, fonts.sans, 9), tableX + 10, ty, 9, fonts.sans, INK)
    textRight(page, fmtInt.format(b.pares), cols[1].x, ty, 9, fonts.sans, INK)
    textRight(page, fmtMoney.format(b.monto), cols[2].x, ty, 9, fonts.sans, INK)
    textRight(page, `${fmtPct.format(b.pctPares)}%`, cols[3].x, ty, 9, fonts.sans, INK_SOFT)
    textRight(page, `${fmtPct.format(b.pctMonto)}%`, cols[4].x, ty, 9, fonts.sans, INK_SOFT)
    ty -= 13
  })

  const used = Math.max(donutSize + 16, yStart - ty)
  return yStart - used - 6
}

function drawTopBars(
  page: PDFPage,
  fonts: Fonts,
  y: number,
  title: string,
  buckets: PillarBucket[],
  showMonto = true,
  topN = 6,
): number {
  const yStart = sectionTitle(page, fonts, y, title)
  if (!buckets.length) {
    text(page, 'Sin datos.', MARGIN, yStart - 14, 9, fonts.sans, INK_MUTED)
    return yStart - 30
  }

  const data = buckets.slice(0, topN)
  const maxPares = data.reduce((m, b) => Math.max(m, b.pares), 0) || 1

  // Layout fila: label (110) · barra (flex) · %pares · pares · monto
  const labelW = 110
  const labelX = MARGIN
  const barX = labelX + labelW + 6
  const valPctX = PAGE_W - MARGIN - 180
  const valParesX = PAGE_W - MARGIN - 100
  const valMontoX = PAGE_W - MARGIN
  const barWMax = valPctX - barX - 14

  let ty = yStart - 6
  for (let i = 0; i < data.length; i++) {
    const b = data[i]
    const lbl = truncate(b.label, labelW, fonts.sans, 9)
    text(page, lbl, labelX, ty, 9, fonts.sans, INK)

    const w = Math.max(2, (b.pares / maxPares) * barWMax)
    // Pista (track) gris claro.
    page.drawRectangle({ x: barX, y: ty - 2, width: barWMax, height: 8, color: RULE_SOFT })
    // Barra coloreada.
    page.drawRectangle({ x: barX, y: ty - 2, width: w, height: 8, color: colorAt(i) })

    textRight(page, `${fmtPct.format(b.pctPares)}%`, valPctX, ty, 8, fonts.sans, INK_SOFT)
    textRight(page, fmtInt.format(b.pares), valParesX, ty, 9, fonts.sansBold, INK)
    if (showMonto) {
      textRight(page, fmtMoney.format(b.monto), valMontoX, ty, 8, fonts.sans, INK_SOFT)
    }
    ty -= 16
  }

  if (buckets.length > topN) {
    text(page, `Top ${topN} de ${buckets.length}`, MARGIN, ty, 7, fonts.sans, INK_MUTED)
    ty -= 10
  }

  return ty - 4
}

async function renderPaginaEjecutiva(
  pdfDoc: PDFDocument,
  fonts: Fonts,
  data: PDFVentasFotosData,
  stats: VentasFotosPillarStats,
  esLimitado: boolean,
  totalFilas: number,
  maxFilasPdf: number,
) {
  const page = pdfDoc.addPage([PAGE_W, PAGE_H])
  drawHeader(page, fonts, data)

  let y = PAGE_H - MARGIN - 78
  y = drawResumen(page, fonts, y, stats)

  // Aviso si PDF está limitado
  if (esLimitado) {
    page.drawRectangle({
      x: MARGIN,
      y: y - 28,
      width: PAGE_W - 2 * MARGIN,
      height: 24,
      color: rgb(1, 0.976, 0.922), // amber-50
      borderColor: rgb(0.976, 0.827, 0.529), // amber-200
      borderWidth: 0.5,
    })
    text(
      page,
      `PDF muestra primeras ${maxFilasPdf} filas con imagen. Total consulta: ${totalFilas} filas. Detalle completo en pantalla.`,
      MARGIN + 8,
      y - 14,
      8,
      fonts.sans,
      rgb(0.596, 0.349, 0.039), // amber-900
    )
    y -= 34
  }

  y = drawGeneroPane(page, fonts, y, stats)
  y = drawTopBars(page, fonts, y, 'Participación por categoría', stats.porCategoria, true, 6)
  y = drawTopBars(page, fonts, y, 'Top estilos', stats.porEstilo, true, 6)
  y = drawTopBars(page, fonts, y, 'Top tipo', stats.porTipo1, true, 6)
  y = drawTopBars(page, fonts, y, 'Top colores', stats.porColor, false, 8)
}

// ─── Páginas siguientes: detalle ─────────────────────────────────────────────
const DETALLE_ROW_H = 64
const DETALLE_TOP = PAGE_H - MARGIN
const DETALLE_BOTTOM = MARGIN + 24

interface DetalleLayout {
  imgX: number
  imgSize: number
  fechaX: number
  refX: number
  catX: number
  cantX: number
  rightLimit: number
}

function detalleLayout(): DetalleLayout {
  const imgX = MARGIN + 4
  const imgSize = 48
  const textStartX = imgX + imgSize + 12
  return {
    imgX,
    imgSize,
    fechaX: textStartX,                  // FECHA (izq)   80px
    refX: textStartX + 60,               // REFERENCIA    140px
    catX: textStartX + 200,              // CATEGORÍA      90px
    cantX: PAGE_W - MARGIN - 4,          // CANTIDAD (der)
    rightLimit: PAGE_W - MARGIN,
  }
}

function drawDetalleHeader(page: PDFPage, fonts: Fonts, data: PDFVentasFotosData, pageIdx: number) {
  const y = PAGE_H - MARGIN + 4
  text(page, 'Detalle de ventas y tránsito', MARGIN, y - 8, 12, fonts.serifBold, INK)
  textRight(
    page,
    `${data.cliente.id} · ${truncate(data.cliente.nombre, 180, fonts.sans, 9)}  ·  ${data.marca.descp_marca}`,
    PAGE_W - MARGIN,
    y - 8,
    9,
    fonts.sans,
    INK_SOFT,
  )
  ruleLine(page, MARGIN, PAGE_W - MARGIN, y - 16, INK, 0.5)

  // Cabecera de columnas (page 2+).
  const L = detalleLayout()
  const hy = y - 30
  text(page, 'FECHA', L.fechaX, hy, 7, fonts.sansBold, INK_MUTED)
  text(page, 'REFERENCIA', L.refX, hy, 7, fonts.sansBold, INK_MUTED)
  text(page, 'CATEGORÍA', L.catX, hy, 7, fonts.sansBold, INK_MUTED)
  textRight(page, 'CANTIDAD', L.cantX, hy, 7, fonts.sansBold, INK_MUTED)
  ruleLine(page, MARGIN, PAGE_W - MARGIN, hy - 4, RULE_SOFT, 0.4)

  // Pequeño indicador de página de detalle.
  textRight(page, `Sección detalle · pág. ${pageIdx}`, PAGE_W - MARGIN, MARGIN, 7, fonts.sans, INK_MUTED)
}

/** Muchas fotos legacy viven solo en productos/{archivo}.jpg (sin tier sm/md). */
function resolveRowImageCandidates(row: VentaFotoRow): string[] {
  const fromExcel = getImagenCandidatesFlatFirst(row.imagen)
  if (row.linea_codigo == null || row.referencia_codigo == null) {
    return fromExcel
  }
  const fromPillars = productImageCandidatesForRow(
    String(row.linea_codigo),
    String(row.referencia_codigo),
    row.material_codigo ?? '',
    row.color_codigo ?? '',
    row.imagen,
    'thumb',
  )
  return mergeImageCandidatesFlatFirst(fromExcel, fromPillars)
}

type FetchImageOutcome =
  | { status: 'ok'; img: PDFImage }
  | { status: 'not_found' }
  | { status: 'network'; detail: string }

async function fetchImage(
  pdfDoc: PDFDocument,
  cache: Map<string, PDFImage>,
  candidates: string[],
  metrics: ImageMetrics,
  deviceType: 'desktop' | 'tablet' | 'mobile',
): Promise<FetchImageOutcome> {
  const urls = candidates.filter(Boolean)
  if (!urls.length) return { status: 'not_found' }

  for (const u of urls) {
    const cached = cache.get(u)
    if (cached) {
      metrics.cached++
      return { status: 'ok', img: cached }
    }
  }

  const primary = urls[0]
  const isServer = typeof window === 'undefined'

  try {
    console.log(`[PDF Ventas-Fotos] Descargando imagen - Dispositivo: ${deviceType}, candidatos: ${urls.length}, flat primero`)

    const resp = await safeFetchImageGarantizado(primary, {
      deviceType,
      maxRetries: isServer ? 1 : 3,
      fallbackUrls: urls.slice(1),
      onProgress: (attempt, max, currentUrl) => {
        console.log(`[PDF Ventas-Fotos]   Intento ${attempt}/${max} para ${currentUrl.split('/').pop()}`)
      },
    })

    const bytes = await resp.arrayBuffer()
    const resolvedUrl = (resp.url || primary).toLowerCase()
    const contentType = (resp.headers.get('content-type') ?? '').toLowerCase()
    let img: PDFImage | null = null

    if (contentType.includes('png') || resolvedUrl.endsWith('.png')) {
      img = await pdfDoc.embedPng(bytes)
    } else if (
      contentType.includes('jpeg') ||
      contentType.includes('jpg') ||
      resolvedUrl.endsWith('.jpg') ||
      resolvedUrl.endsWith('.jpeg')
    ) {
      img = await pdfDoc.embedJpg(bytes)
    } else {
      try {
        img = await pdfDoc.embedJpg(bytes)
      } catch {
        img = await pdfDoc.embedPng(bytes)
      }
    }

    if (img) {
      for (const u of urls) cache.set(u, img)
      metrics.downloaded++
      return { status: 'ok', img }
    }

    console.warn('[PDF Ventas-Fotos] Formato de imagen no soportado:', primary)
    metrics.fallback++
    return { status: 'not_found' }
  } catch (e) {
    metrics.fallback++
    if (e instanceof ImageLoadError && e.kind === 'not_found') {
      console.log('[PDF Ventas-Fotos] Imagen inexistente en Storage:', primary)
      return { status: 'not_found' }
    }
    const detail = e instanceof Error ? e.message : String(e)
    console.error('[PDF Ventas-Fotos] FALLO DE RED/SEÑAL tras reintentos:', primary, detail)
    return { status: 'network', detail }
  }
}

function drawPlaceholder(page: PDFPage, fonts: Fonts, x: number, y: number, size: number, label: string) {
  page.drawRectangle({ x, y, width: size, height: size, color: PAPER_ALT, borderColor: RULE_SOFT, borderWidth: 0.5 })
  textCenter(page, label, x + size / 2, y + size / 2 - 3, 6.5, fonts.sansBold, INK_MUTED)
}

interface ImageMetrics {
  downloaded: number
  cached: number
  fallback: number
}

export type PreloadVentasFotosResult = {
  rowCache: Map<string, PDFImage>
  /** Archivos que no existen en Storage — no bloquean el PDF. */
  missingInStorage: string[]
}

/**
 * Precarga paralela.
 * - Inexistente en Storage (404) → placeholder + alerta (no aborta).
 * - Fallo de red/señal tras reintentos → aborta (espíritu de integridad del PDF).
 */
async function preloadVentasFotosImages(
  pdfDoc: PDFDocument,
  rows: VentaFotoRow[],
  deviceType: 'desktop' | 'tablet' | 'mobile',
  metrics: ImageMetrics,
): Promise<PreloadVentasFotosResult> {
  const byImagen = new Map<string, VentaFotoRow>()
  for (const row of rows) {
    const key = row.imagen?.trim()
    if (key && !byImagen.has(key)) byImagen.set(key, row)
  }

  const urlCache = new Map<string, PDFImage>()
  const rowCache = new Map<string, PDFImage>()
  const missingInStorage: string[] = []
  const networkFails: string[] = []
  const entries = [...byImagen.entries()]
  const isServer = typeof window === 'undefined'
  const concurrency = isServer ? 10 : getConcurrencyLimit(deviceType)
  let next = 0

  async function worker() {
    while (next < entries.length) {
      const idx = next++
      const [imagenKey, row] = entries[idx]
      const candidates = resolveRowImageCandidates(row)
      const outcome = await fetchImage(pdfDoc, urlCache, candidates, metrics, deviceType)
      if (outcome.status === 'ok') {
        rowCache.set(imagenKey, outcome.img)
      } else if (outcome.status === 'not_found') {
        missingInStorage.push(imagenKey)
      } else {
        networkFails.push(`${imagenKey} (${outcome.detail})`)
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, Math.max(entries.length, 1)) }, () => worker()),
  )

  if (networkFails.length > 0) {
    const preview = networkFails.slice(0, 4).join('; ')
    throw new Error(
      `PDF abortado — fallo de red/señal al descargar foto(s) (no es ausencia en Storage). Reintentá. Detalle: ${preview}${networkFails.length > 4 ? '…' : ''}`,
    )
  }

  if (missingInStorage.length > 0) {
    console.warn(
      `[PDF Ventas-Fotos] ${missingInStorage.length} imagen(es) inexistente(s) en Storage — PDF continúa con placeholder: ${missingInStorage.slice(0, 6).join(', ')}`,
    )
  }

  console.log(`[PDF Ventas-Fotos] Precarga OK: ${rowCache.size} imagen(es) únicas · ausentes Storage: ${missingInStorage.length}`)
  return { rowCache, missingInStorage }
}

async function renderDetalle(
  pdfDoc: PDFDocument,
  fonts: Fonts,
  data: PDFVentasFotosData,
  rowsLimitadas: VentaFotoRow[],
  imageCache: Map<string, PDFImage>,
) {
  if (!rowsLimitadas.length) return

  let page: PDFPage = pdfDoc.addPage([PAGE_W, PAGE_H])
  let pageDetalleIdx = 1
  drawDetalleHeader(page, fonts, data, pageDetalleIdx)
  let y = DETALLE_TOP - 50

  const L = detalleLayout()

  for (let i = 0; i < rowsLimitadas.length; i++) {
    if (y - DETALLE_ROW_H < DETALLE_BOTTOM) {
      pageDetalleIdx += 1
      page = pdfDoc.addPage([PAGE_W, PAGE_H])
      drawDetalleHeader(page, fonts, data, pageDetalleIdx)
      y = DETALLE_TOP - 50
    }

    const row = rowsLimitadas[i]
    const rowTop = y
    const rowBottom = y - DETALLE_ROW_H

    // Fondo alterno suave.
    if (i % 2 === 1) {
      page.drawRectangle({ x: MARGIN, y: rowBottom + 2, width: PAGE_W - 2 * MARGIN, height: DETALLE_ROW_H - 2, color: PAPER_ALT })
    }

    // Imagen — ya precargada; sin S/IMG silencioso
    const imgY = rowBottom + (DETALLE_ROW_H - L.imgSize) / 2
    const imagenKey = row.imagen?.trim()
    const img = imagenKey ? imageCache.get(imagenKey) : undefined
    if (img) {
      const ratio = img.width / img.height
      let w = L.imgSize
      let h = L.imgSize
      if (ratio > 1) {
        h = L.imgSize / ratio
      } else {
        w = L.imgSize * ratio
      }
      const ix = L.imgX + (L.imgSize - w) / 2
      const iy = imgY + (L.imgSize - h) / 2
      page.drawRectangle({ x: L.imgX, y: imgY, width: L.imgSize, height: L.imgSize, borderColor: RULE_SOFT, borderWidth: 0.5 })
      page.drawImage(img, { x: ix, y: iy, width: w, height: h })
    } else {
      drawPlaceholder(page, fonts, L.imgX, imgY, L.imgSize, 'S/IMG')
    }

    // Líneas de texto (centradas verticalmente).
    const baseY = rowBottom + DETALLE_ROW_H / 2 + 3
    text(page, row.fecha, L.fechaX, baseY, 8, fonts.sansBold, INK)

    const ref = truncate(row.imagen || '—', L.catX - L.refX - 8, fonts.sans, 8)
    text(page, ref, L.refX, baseY, 8, fonts.sans, INK)

    const cat = truncate(row.descp_categoria || '—', L.cantX - L.catX - 8, fonts.sans, 8)
    text(page, cat, L.catX, baseY, 8, fonts.sans, INK_SOFT)

    textRight(page, fmtInt.format(row.cantidad), L.cantX, baseY, 9, fonts.sansBold, INK)

    // Línea inferior fina.
    ruleLine(page, MARGIN, PAGE_W - MARGIN, rowBottom + 1, RULE_SOFT, 0.3)

    y -= DETALLE_ROW_H
  }
}

// ─── Footer global ───────────────────────────────────────────────────────────
function drawFooters(pdfDoc: PDFDocument, fonts: Fonts) {
  const pages = pdfDoc.getPages()
  pages.forEach((p, idx) => {
    const total = pages.length
    textCenter(
      p,
      `Informe de ventas con fotos  ·  página ${idx + 1} de ${total}`,
      PAGE_W / 2,
      20,
      7.5,
      fonts.sans,
      INK_MUTED,
    )
  })
}

// ─── Fallback: si no llega pillarStats lo derivamos de las filas ─────────────
function deriveStats(rows: VentaFotoRow[]): VentasFotosPillarStats {
  const totalPares = rows.reduce((s, r) => s + Math.abs(r.cantidad), 0)
  const totalMonto = rows.reduce((s, r) => s + Math.abs(r.monto), 0)
  const articulosUnicos = new Set(rows.map((r) => r.imagen).filter(Boolean)).size
  const sinClasificar = rows.filter((r) => !r.genero && !r.estilo && !r.tipo_1).length

  function bucket(keyOf: (r: VentaFotoRow) => string | null | undefined): PillarBucket[] {
    const groups = new Map<string, { pares: number; monto: number }>()
    for (const r of rows) {
      const raw = keyOf(r)
      const label = (raw && String(raw).trim()) || 'Sin clasificar'
      const acc = groups.get(label) ?? { pares: 0, monto: 0 }
      acc.pares += Math.abs(r.cantidad)
      acc.monto += Math.abs(r.monto)
      groups.set(label, acc)
    }
    const out: PillarBucket[] = []
    for (const [label, { pares, monto }] of groups) {
      out.push({
        label,
        pares,
        monto,
        pctPares: totalPares ? (pares / totalPares) * 100 : 0,
        pctMonto: totalMonto ? (monto / totalMonto) * 100 : 0,
      })
    }
    out.sort((a, b) => b.monto - a.monto || b.pares - a.pares)
    return out
  }

  return {
    resumen: { totalPares, totalMonto, articulosUnicos, sinClasificar },
    porGenero: bucket((r) => r.genero),
    porEstilo: bucket((r) => r.estilo),
    porTipo1: bucket((r) => r.tipo_1),
    porColor: bucket((r) => r.color_nombre),
    porCategoria: bucket((r) => r.descp_categoria),
  }
}

// ─── Entrada principal ──────────────────────────────────────────────────────
/** Mismo tope en server y cliente desktop — paridad getRecommendedImageLimit('desktop'). */
const PDF_MAX_FILAS_VENTAS_FOTOS = 80

export type GenerarPDFVentasFotosResult = {
  buffer: Buffer
  /** Archivos ausentes en Storage — PDF OK con placeholder; UI muestra alerta. */
  missingInStorage: string[]
}

export async function generarPDFVentasFotos(data: PDFVentasFotosData): Promise<GenerarPDFVentasFotosResult> {
  const startTime = performance.now()

  const isServerless = typeof window === 'undefined' && Boolean(process.env.VERCEL)
  const deviceType = isServerless ? 'desktop' : detectDeviceType()
  const isIOS = isServerless ? false : isIOSDevice()
  const maxFilasCap = isServerless
    ? Number(process.env.PDF_VENTAS_FOTOS_MAX_FILAS) || PDF_MAX_FILAS_VENTAS_FOTOS
    : getRecommendedImageLimit(deviceType)

  console.log('[PDF Ventas-Fotos] ═══════════════════════════════════════════════════')
  console.log('[PDF Ventas-Fotos] Iniciando generación...')
  console.log('[PDF Ventas-Fotos] Dispositivo detectado:', deviceType)
  if (isServerless) {
    console.log('[PDF Ventas-Fotos] Serverless · tope filas:', maxFilasCap)
  }
  if (isIOS) {
    console.log('[PDF Ventas-Fotos] 🍎 Sistema operativo: iOS (Safari)')
    console.log('[PDF Ventas-Fotos] ⚠️  IMPORTANTE: Mantén esta pestaña visible durante toda la generación')
    console.log('[PDF Ventas-Fotos] ⚠️  Safari puede pausar descargas si cambias de pestaña')
  }
  console.log('[PDF Ventas-Fotos] Filas totales:', data.rows.length)

  if (!data.rows.length) {
    throw new Error('PDF abortado — no hay filas de ventas para el informe.')
  }

  try {
    const MAX_FILAS_PDF = Math.min(data.rows.length, maxFilasCap)
    const rowsLimitadas = data.rows.slice(0, MAX_FILAS_PDF)
    const esLimitado = data.rows.length > MAX_FILAS_PDF

    if (esLimitado) {
      console.warn(`[PDF Ventas-Fotos] Limitando a ${MAX_FILAS_PDF} filas de ${data.rows.length}`)
      if (isIOS) {
        console.warn(`[PDF Ventas-Fotos] 🍎 Límite reducido para iOS por restricciones de memoria en Safari`)
      }
    }

    const pdfDoc = await PDFDocument.create()
    const fonts: Fonts = {
      serif: await pdfDoc.embedFont(StandardFonts.TimesRoman),
      serifBold: await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
      sans: await pdfDoc.embedFont(StandardFonts.Helvetica),
      sansBold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    }

    const stats = data.pillarStats ?? deriveStats(data.rows)
    const imageMetrics: ImageMetrics = { downloaded: 0, cached: 0, fallback: 0 }

    const { rowCache: imageCache, missingInStorage } = await preloadVentasFotosImages(
      pdfDoc,
      rowsLimitadas,
      deviceType,
      imageMetrics,
    )

    await renderPaginaEjecutiva(pdfDoc, fonts, data, stats, esLimitado, data.rows.length, MAX_FILAS_PDF)
    await renderDetalle(pdfDoc, fonts, data, rowsLimitadas, imageCache)
    drawFooters(pdfDoc, fonts)

    const pdfBytes = await pdfDoc.save()
    const endTime = performance.now()
    const durationMs = Math.round(endTime - startTime)
    const durationSec = (durationMs / 1000).toFixed(1)

    console.log(`[PDF Ventas-Fotos] ═══════════════════════════════════════════════════`)
    console.log(`[PDF Ventas-Fotos] ✅ PDF GENERADO EXITOSAMENTE`)
    console.log(`[PDF Ventas-Fotos]   - Tiempo total: ${durationSec}s (${durationMs}ms)`)
    console.log(`[PDF Ventas-Fotos]   - Filas procesadas: ${rowsLimitadas.length}`)
    console.log(`[PDF Ventas-Fotos]   - Imágenes descargadas: ${imageMetrics.downloaded}`)
    console.log(`[PDF Ventas-Fotos]   - Imágenes en caché: ${imageMetrics.cached}`)
    if (missingInStorage.length > 0) {
      console.log(`[PDF Ventas-Fotos]   ⚠️  Ausentes en Storage (placeholder): ${missingInStorage.length}`)
    } else {
      console.log(`[PDF Ventas-Fotos]   ✅ TODAS las imágenes cargadas — sin placeholders`)
    }
    console.log(`[PDF Ventas-Fotos]   - Tamaño: ${Math.round(pdfBytes.length / 1024)}KB`)
    console.log(`[PDF Ventas-Fotos] ═══════════════════════════════════════════════════`)

    return { buffer: Buffer.from(pdfBytes), missingInStorage }
  } catch (error) {
    console.error('[PDF Ventas-Fotos] Exception en generación:', error)
    throw error
  }
}
