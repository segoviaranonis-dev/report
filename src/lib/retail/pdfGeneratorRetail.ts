/**
 * Generador de PDF profesional para Retail Stock
 *
 * Usa pdf-lib (no html2canvas) para layout manual preciso
 * Siguiendo el patrón de ventas-fotos para robustez y calidad
 */

import { PDFDocument, type PDFFont, type PDFImage, type PDFPage, StandardFonts, rgb } from 'pdf-lib'
import type { ColumnaStockRetail } from './types'
import { safeFetchImage } from '../pdf/imageUrlValidator'

// ─── PALETA RIMEC ────────────────────────────────────────────────────────────
const NAVY = rgb(0.118, 0.227, 0.373)        // #1e3a5f - report-navy
const NAVY2 = rgb(0.176, 0.294, 0.451)       // #2d4b73 - report-navy2
const INK = rgb(0.200, 0.200, 0.200)         // #333333 - report-ink
const INK_MUTED = rgb(0.451, 0.451, 0.451)   // #737373 - report-muted
const MUTED = rgb(0.451, 0.451, 0.451)       // #737373 - report-muted
const PAPER = rgb(0.980, 0.973, 0.961)       // #faf8f5 - report-paper
const PAPER2 = rgb(0.969, 0.957, 0.937)      // #f7f4ef - report-paper2
const RULE = rgb(0.855, 0.824, 0.784)        // #dad2c8 - report-rule
const WHITE = rgb(1, 1, 1)

// Colores para badges de tarjetas (tonos pastel suaves)
const SHELL_COLORS = [
  { bg: rgb(0.980, 0.976, 0.969), border: rgb(0.905, 0.898, 0.882), badge: rgb(0.647, 0.596, 0.565) }, // stone pastel
  { bg: rgb(1, 0.969, 0.929), border: rgb(0.996, 0.843, 0.667), badge: rgb(0.89, 0.62, 0.49) },        // melon pastel
  { bg: rgb(0.961, 0.953, 1), border: rgb(0.867, 0.839, 0.996), badge: rgb(0.71, 0.58, 0.85) },        // lavender pastel
  { bg: rgb(0.925, 0.992, 0.961), border: rgb(0.655, 0.953, 0.816), badge: rgb(0.54, 0.76, 0.69) },    // sage pastel
]

// ─── CONSTANTES DE PÁGINA ────────────────────────────────────────────────────
const PAGE_W = 595  // A4 portrait width
const PAGE_H = 842  // A4 portrait height
const MARGIN = 40

// ─── TIPOS ───────────────────────────────────────────────────────────────────
export interface PDFRetailData {
  batchLabel: string
  columnas: ColumnaStockRetail[]
}

export interface PDFProgressCallback {
  (current: number, total: number): void
}

interface Fonts {
  serif: PDFFont
  serifBold: PDFFont
  sans: PDFFont
  sansBold: PDFFont
}

interface ImageCache {
  cache: Map<string, PDFImage>
  metrics: {
    downloaded: number
    cached: number
    fallback: number
  }
}

// ─── HELPERS DE TEXTO ────────────────────────────────────────────────────────
function sanitize(s: string): string {
  return String(s ?? '')
    .replace(/[→➜➡]/g, '->')
    .replace(/[…]/g, '...')
    .replace(/[•·]/g, '·')
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
}

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

function ruleLine(
  page: PDFPage,
  x1: number,
  x2: number,
  y: number,
  color = RULE,
  thickness = 0.5
) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, color, thickness })
}

function truncate(s: string, max: number, font: PDFFont, size: number): string {
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

// ─── HEADER Y FOOTER ─────────────────────────────────────────────────────────
function drawHeader(
  page: PDFPage,
  fonts: Fonts,
  data: PDFRetailData,
  pageNum: number,
  totalPages: number
) {
  const top = PAGE_H - MARGIN

  // Fondo del header
  page.drawRectangle({
    x: 0,
    y: top - 28,
    width: PAGE_W,
    height: 28,
    color: NAVY
  })

  // Título
  textCenter(page, 'Reporte Ventas - Stock', PAGE_W / 2, top - 12, 16, fonts.serifBold, WHITE)

  // Subtítulo (lote)
  textCenter(page, data.batchLabel, PAGE_W / 2, top - 24, 10, fonts.sans, WHITE)

  // Línea decorativa
  ruleLine(page, 0, PAGE_W, top - 28, RULE, 0.5)
}

function drawFooter(
  page: PDFPage,
  fonts: Fonts,
  pageNum: number,
  totalPages: number
) {
  const bottom = MARGIN

  // Línea superior
  ruleLine(page, MARGIN, PAGE_W - MARGIN, bottom + 18, RULE, 0.3)

  // Texto del footer
  text(page, 'RIMEC · Informe Retail', MARGIN, bottom + 8, 8, fonts.sans, MUTED)

  // Fecha y hora
  const fecha = new Date().toLocaleString('es-PY', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
  textCenter(page, fecha, PAGE_W / 2, bottom + 8, 8, fonts.sans, MUTED)

  // Paginación
  textRight(page, `Pág. ${pageNum} de ${totalPages}`, PAGE_W - MARGIN, bottom + 8, 8, fonts.sans, MUTED)
}

// ─── LAYOUT DE TARJETAS ──────────────────────────────────────────────────────
interface CardLayout {
  x: number
  y: number
  width: number
  height: number
}

function calculateCardGrid(): CardLayout[] {
  // Grid 2 filas × 3 columnas
  const headerSpace = 70  // Espacio para header (aumentado para evitar solapamiento)
  const footerSpace = 40  // Espacio para footer
  const availableHeight = PAGE_H - headerSpace - footerSpace
  const availableWidth = PAGE_W - (MARGIN * 2)

  const cols = 3
  const rows = 2
  const gap = 12

  const cardWidth = (availableWidth - (gap * (cols - 1))) / cols
  const cardHeight = (availableHeight - (gap * (rows - 1))) / rows

  const positions: CardLayout[] = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      positions.push({
        x: MARGIN + col * (cardWidth + gap),
        y: PAGE_H - headerSpace - (row + 1) * cardHeight - row * gap,
        width: cardWidth,
        height: cardHeight
      })
    }
  }

  return positions
}

// ─── MANEJO DE IMÁGENES ──────────────────────────────────────────────────────
async function fetchImage(
  pdfDoc: PDFDocument,
  cache: ImageCache,
  url: string | null
): Promise<PDFImage | null> {
  if (!url) {
    cache.metrics.fallback++
    return null
  }

  const cached = cache.cache.get(url)
  if (cached) {
    cache.metrics.cached++
    return cached
  }

  try {
    const resp = await safeFetchImage(url, 5000)
    if (!resp) {
      cache.metrics.fallback++
      return null
    }

    const bytes = await resp.arrayBuffer()
    const lower = url.toLowerCase()
    let img: PDFImage | null = null

    if (lower.endsWith('.png')) {
      img = await pdfDoc.embedPng(bytes)
    } else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
      img = await pdfDoc.embedJpg(bytes)
    }

    if (img) {
      cache.cache.set(url, img)
      cache.metrics.downloaded++
      return img
    }

    cache.metrics.fallback++
    return null
  } catch (e) {
    console.warn('[PDF Retail] Error cargando imagen', url, e)
    cache.metrics.fallback++
    return null
  }
}

function drawPlaceholder(
  page: PDFPage,
  fonts: Fonts,
  x: number,
  y: number,
  size: number
) {
  page.drawRectangle({
    x,
    y,
    width: size,
    height: size,
    color: PAPER2,
    borderColor: RULE,
    borderWidth: 0.5
  })
  textCenter(page, 'S/IMG', x + size / 2, y + size / 2 - 3, 7, fonts.sansBold, MUTED)
}

async function drawTarjeta(
  page: PDFPage,
  fonts: Fonts,
  card: ColumnaStockRetail,
  layout: CardLayout,
  shellIdx: number,
  imageCache: ImageCache,
  pdfDoc: PDFDocument
) {
  const { x, y, width, height } = layout
  const shell = SHELL_COLORS[shellIdx % SHELL_COLORS.length]

  // Fondo de la tarjeta
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: shell.bg,
    borderColor: shell.border,
    borderWidth: 1
  })

  // Área de imagen (parte superior, ~40% de la altura)
  const imgHeight = height * 0.40
  const imgY = y + height - imgHeight

  // Badge de ranking (esquina superior izquierda)
  const rankingBadgeW = 32
  const rankingBadgeH = 18
  page.drawRectangle({
    x: x + 6,
    y: imgY + imgHeight - rankingBadgeH - 6,
    width: rankingBadgeW,
    height: rankingBadgeH,
    color: shell.badge
  })
  textCenter(
    page,
    `#${card.ranking}`,
    x + 6 + rankingBadgeW / 2,
    imgY + imgHeight - 13,
    9,
    fonts.sansBold,
    WHITE
  )

  // Badge "VENTA" (al lado del ranking)
  const ventaBadgeW = 38
  const ventaBadgeH = 14
  page.drawRectangle({
    x: x + 6 + rankingBadgeW + 4,
    y: imgY + imgHeight - ventaBadgeH - 8,
    width: ventaBadgeW,
    height: ventaBadgeH,
    color: PAPER
  })
  textCenter(
    page,
    'VENTA',
    x + 6 + rankingBadgeW + 4 + ventaBadgeW / 2,
    imgY + imgHeight - 16,
    6.5,
    fonts.sansBold,
    INK
  )

  // Pares vendidos (esquina inferior derecha del área de imagen)
  const paresW = 60
  const paresH = 20
  page.drawRectangle({
    x: x + width - paresW - 6,
    y: imgY + 6,
    width: paresW,
    height: paresH,
    color: WHITE
  })
  textCenter(
    page,
    `${card.totalVenta} pares`,
    x + width - paresW - 6 + paresW / 2,
    imgY + 13,
    10,
    fonts.serifBold,
    shell.badge
  )

  // Cargar y dibujar imagen del producto
  const imgSize = Math.min(width - 16, imgHeight - 50) // Cuadrada, centrada
  const imgX = x + (width - imgSize) / 2
  const imgAreaY = imgY + (imgHeight - imgSize) / 2 - 5

  // Intentar cargar la primera imagen de candidatos
  const imageCandidates = card.imageCandidates ?? (card.imageSrc ? [card.imageSrc] : [])
  let productImage: PDFImage | null = null

  for (const candidate of imageCandidates) {
    productImage = await fetchImage(pdfDoc, imageCache, candidate)
    if (productImage) break
  }

  if (productImage) {
    // Calcular dimensiones manteniendo proporción
    const ratio = productImage.width / productImage.height
    let drawWidth = imgSize
    let drawHeight = imgSize

    if (ratio > 1) {
      // Imagen horizontal
      drawHeight = imgSize / ratio
    } else if (ratio < 1) {
      // Imagen vertical
      drawWidth = imgSize * ratio
    }

    const finalImgX = imgX + (imgSize - drawWidth) / 2
    const finalImgY = imgAreaY + (imgSize - drawHeight) / 2

    // Borde de la imagen
    page.drawRectangle({
      x: imgX,
      y: imgAreaY,
      width: imgSize,
      height: imgSize,
      borderColor: RULE,
      borderWidth: 0.5
    })

    // Dibujar imagen
    page.drawImage(productImage, {
      x: finalImgX,
      y: finalImgY,
      width: drawWidth,
      height: drawHeight
    })
  } else {
    // Placeholder si no hay imagen
    drawPlaceholder(page, fonts, imgX, imgAreaY, imgSize)
  }

  // Área de contenido (parte inferior, 60% de la altura)
  const contentHeight = height * 0.60
  const contentY = y
  const contentX = x + 6
  const contentWidth = width - 12

  let yOffset = contentY + contentHeight - 6 // Empezar más arriba

  // Nombre del archivo (truncado) - DESTACADO
  const imageName = card.imagenArchivo || card.imageSearchName || '—'
  const nameText = truncate(imageName, contentWidth, fonts.sans, 8.5)
  text(page, nameText, contentX, yOffset, 8.5, fonts.sansBold, INK)
  yOffset -= 12

  // Preparar datos de tiendas desde la estructura correcta
  const tiendasData = card.tiendas.map(t => {
    const venta = card.ventaPorTienda.find(v => v.tienda === t.nombre)?.pares || 0
    const stock = t.stock.reduce((sum, s) => sum + s, 0)
    return { nombre: t.nombre, venta, stock }
  }).filter(t => t.venta > 0 || t.stock > 0)

  // LÍNEA DE TOTALES POR TIENDA (Fernando: 15 | Palma: 17 | San Martín: 19)
  if (tiendasData.length > 0) {
    const totalesLine = tiendasData
      .map(t => `${t.nombre}: ${t.venta}`)
      .join('  |  ')

    text(page, totalesLine, contentX, yOffset, 7.5, fonts.sansBold, INK)
    yOffset -= 11
  }

  // Badge principal (marca/línea desde origenLabel)
  if (card.origenLabel && card.origenLabel !== '—') {
    const marcaBadgeW = Math.min(contentWidth, 85)
    const marcaBadgeH = 11

    page.drawRectangle({
      x: contentX,
      y: yOffset - marcaBadgeH,
      width: marcaBadgeW,
      height: marcaBadgeH,
      color: shell.badge
    })

    const marcaText = truncate(card.origenLabel, marcaBadgeW - 4, fonts.sans, 6.5)
    textCenter(
      page,
      marcaText.toUpperCase(),
      contentX + marcaBadgeW / 2,
      yOffset - 7,
      6.5,
      fonts.sansBold,
      WHITE
    )

    yOffset -= marcaBadgeH + 5
  }

  // Tablas de tallas por tienda
  card.tiendas.forEach((tienda, tiendaIdx) => {
    const ventaTienda = card.ventaPorTienda.find(v => v.tienda === tienda.nombre)?.pares || 0
    if (ventaTienda === 0 && tienda.stock.every(s => s === 0)) return // Skip si no hay datos

    yOffset -= 3

    // Color de la tienda (tonos pastel)
    const tiendaColor = tiendaIdx === 0 ? rgb(0.93, 0.70, 0.62) : tiendaIdx === 1 ? rgb(0.70, 0.85, 0.65) : rgb(0.65, 0.78, 0.88)
    const totalStock = tienda.stock.reduce((sum, s) => sum + s, 0)

    // Calcular altura total de la tabla
    const headerH = 11
    const cellH = 8
    const tableHeight = headerH + (cellH * 3) + 1 // header + 3 filas + padding

    // BORDE COLOREADO alrededor de toda la tabla
    page.drawRectangle({
      x: contentX - 1,
      y: yOffset - tableHeight,
      width: contentWidth + 2,
      height: tableHeight,
      borderColor: tiendaColor,
      borderWidth: 2
    })

    // Header de tienda
    page.drawRectangle({
      x: contentX,
      y: yOffset - headerH,
      width: contentWidth,
      height: headerH,
      color: tiendaColor
    })

    // Nombre a la izquierda
    text(page, tienda.nombre.toUpperCase(), contentX + 3, yOffset - 7.5, 6.5, fonts.sansBold, WHITE)

    // Totales a la DERECHA (15v / 10s)
    const totalesText = `${ventaTienda}v / ${totalStock}s`
    textRight(page, totalesText, contentX + contentWidth - 3, yOffset - 7.5, 6.5, fonts.sansBold, WHITE)

    yOffset -= headerH

    // Tabla de tallas (solo si hay tallas)
    if (tienda.tallas.length > 0) {
      const labelW = 28 // Ancho para las etiquetas VENTA/STOCK
      const availableW = contentWidth - labelW - 2
      const cellW = Math.min(availableW / Math.max(tienda.tallas.length, 7), 13)
      const cellH = 8

      // Fila de tallas (números) - FONDO GRIS CLARO
      let cellX = contentX + labelW + 2 // Dejar espacio para etiqueta
      tienda.tallas.forEach((talla) => {
        page.drawRectangle({
          x: cellX,
          y: yOffset - cellH,
          width: cellW,
          height: cellH,
          color: rgb(0.96, 0.96, 0.96),
          borderColor: rgb(0.85, 0.85, 0.85),
          borderWidth: 0.4
        })
        textCenter(page, talla, cellX + cellW / 2, yOffset - 5.5, 5.5, fonts.sansBold, INK)
        cellX += cellW
      })
      yOffset -= cellH

      // Fila de VENTA con etiqueta
      // Etiqueta "VENTA"
      page.drawRectangle({
        x: contentX,
        y: yOffset - cellH,
        width: labelW,
        height: cellH,
        color: rgb(0.95, 0.95, 0.95),
        borderColor: rgb(0.85, 0.85, 0.85),
        borderWidth: 0.4
      })
      text(page, 'VENTA', contentX + 2, yOffset - 5.5, 5.5, fonts.sansBold, INK)

      // Celdas de números
      cellX = contentX + labelW + 2
      tienda.venta.forEach((v) => {
        page.drawRectangle({
          x: cellX,
          y: yOffset - cellH,
          width: cellW,
          height: cellH,
          color: WHITE,
          borderColor: rgb(0.85, 0.85, 0.85),
          borderWidth: 0.4
        })
        const ventaVal = v === null ? '—' : String(v)
        textCenter(page, ventaVal, cellX + cellW / 2, yOffset - 5.5, 5.5, fonts.sansBold, tiendaColor)
        cellX += cellW
      })
      yOffset -= cellH

      // Fila de STOCK con etiqueta
      // Etiqueta "STOCK"
      page.drawRectangle({
        x: contentX,
        y: yOffset - cellH,
        width: labelW,
        height: cellH,
        color: rgb(0.95, 0.95, 0.95),
        borderColor: rgb(0.85, 0.85, 0.85),
        borderWidth: 0.4
      })
      text(page, 'STOCK', contentX + 2, yOffset - 5.5, 5.5, fonts.sansBold, INK)

      // Celdas de números
      cellX = contentX + labelW + 2
      tienda.stock.forEach((s) => {
        page.drawRectangle({
          x: cellX,
          y: yOffset - cellH,
          width: cellW,
          height: cellH,
          color: WHITE,
          borderColor: rgb(0.85, 0.85, 0.85),
          borderWidth: 0.4
        })
        const stockVal = s === 0 ? '—' : String(s)
        textCenter(page, stockVal, cellX + cellW / 2, yOffset - 5.5, 5.5, fonts.sans, MUTED)
        cellX += cellW
      })
      yOffset -= cellH + 3
    }
  })

  // Stock importadora si existe
  if (card.importadora && card.importadora.stockTotal > 0) {
    yOffset -= 3

    const importHeaderH = 11
    const importBodyH = 22
    const importTotalH = importHeaderH + importBodyH

    // Borde completo de importadora
    page.drawRectangle({
      x: contentX - 1,
      y: yOffset - importTotalH,
      width: contentWidth + 2,
      height: importTotalH,
      borderColor: rgb(0.3, 0.3, 0.3),
      borderWidth: 2
    })

    // Header negro "RIMEC — STOCK IMPORTADORA"
    page.drawRectangle({
      x: contentX,
      y: yOffset - importHeaderH,
      width: contentWidth,
      height: importHeaderH,
      color: rgb(0.15, 0.15, 0.15)
    })

    // Texto header (solo título, sin grada)
    text(page, 'RIMEC — STOCK IMPORTADORA', contentX + 3, yOffset - 7.5, 6, fonts.sansBold, WHITE)

    yOffset -= importHeaderH

    // Cuerpo de importadora (fondo claro)
    page.drawRectangle({
      x: contentX,
      y: yOffset - importBodyH,
      width: contentWidth,
      height: importBodyH,
      color: rgb(0.98, 0.98, 0.99)
    })

    // Label "STOCK IMPORTADORA"
    text(page, 'STOCK IMPORTADORA', contentX + 3, yOffset - 10, 7, fonts.sans, MUTED)

    // Número grande de stock
    const stockText = String(card.importadora.stockTotal)
    textRight(page, stockText, contentX + contentWidth - 5, yOffset - 18, 14, fonts.serifBold, rgb(0.3, 0.3, 0.3))

    yOffset -= importBodyH
  }
}

// ─── FUNCIÓN PRINCIPAL ───────────────────────────────────────────────────────
export async function generarPDFRetail(
  data: PDFRetailData,
  onProgress?: PDFProgressCallback
): Promise<Buffer> {
  const startTime = performance.now()
  console.log('[PDF Retail] Iniciando generación...')
  console.log('[PDF Retail] Total tarjetas:', data.columnas.length)

  try {
    const pdfDoc = await PDFDocument.create()
    const fonts: Fonts = {
      serif: await pdfDoc.embedFont(StandardFonts.TimesRoman),
      serifBold: await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
      sans: await pdfDoc.embedFont(StandardFonts.Helvetica),
      sansBold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    }

    const imageCache: ImageCache = {
      cache: new Map(),
      metrics: { downloaded: 0, cached: 0, fallback: 0 }
    }

    // Renderizar páginas (6 tarjetas por página)
    const CARDS_PER_PAGE = 6
    const totalPages = Math.ceil(data.columnas.length / CARDS_PER_PAGE)

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const page = pdfDoc.addPage([PAGE_W, PAGE_H])
      const startIdx = pageIdx * CARDS_PER_PAGE
      const endIdx = Math.min(startIdx + CARDS_PER_PAGE, data.columnas.length)
      const cardsInPage = data.columnas.slice(startIdx, endIdx)

      // Header
      drawHeader(page, fonts, data, pageIdx + 1, totalPages)

      // Footer
      drawFooter(page, fonts, pageIdx + 1, totalPages)

      // Renderizar tarjetas en grid
      const cardPositions = calculateCardGrid()
      for (let i = 0; i < cardsInPage.length; i++) {
        await drawTarjeta(
          page,
          fonts,
          cardsInPage[i],
          cardPositions[i],
          startIdx + i,
          imageCache,
          pdfDoc
        )
      }

      // Progreso
      if (onProgress) {
        onProgress(endIdx, data.columnas.length)
      }
    }

    const pdfBytes = await pdfDoc.save()
    const endTime = performance.now()
    const durationMs = Math.round(endTime - startTime)

    console.log(`[PDF Retail] ✓ PDF generado en ${durationMs}ms`)
    console.log(`[PDF Retail]   - Tarjetas procesadas: ${data.columnas.length}`)
    console.log(`[PDF Retail]   - Imágenes descargadas: ${imageCache.metrics.downloaded}`)
    console.log(`[PDF Retail]   - Imágenes en caché: ${imageCache.metrics.cached}`)
    console.log(`[PDF Retail]   - Imágenes fallback: ${imageCache.metrics.fallback}`)
    console.log(`[PDF Retail]   - Tamaño: ${Math.round(pdfBytes.length / 1024)}KB`)

    return Buffer.from(pdfBytes)
  } catch (error) {
    console.error('[PDF Retail] Exception en generación:', error)
    throw error
  }
}
