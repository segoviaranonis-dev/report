/**
 * Generador de PDF para Ventas con Fotos
 * Incluye: foto, fecha, referencia, pilares (L-R-M-C), cantidad, monto, tipo, categoría
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { safeFetchImage } from '../pdf/imageUrlValidator'
import type { VentaFotoRow, VentasFotosKpis, VentasFotosMarca } from './types'

// Colores Nexus Report
const AZUL_NEXUS = rgb(0.106, 0.227, 0.42) // #1B3A6B
const DORADO_NEXUS = rgb(0.831, 0.686, 0.216) // #D4AF37
const GRIS_CLARO = rgb(0.973, 0.980, 0.988) // #F8FAFC
const GRIS_TEXTO = rgb(0.118, 0.161, 0.235) // #1E293B

export interface PDFVentasFotosData {
  cliente: { id: string; nombre: string }
  marca: VentasFotosMarca
  filtros: {
    fechaInicio: string
    fechaFin: string
  }
  kpis: VentasFotosKpis
  rows: VentaFotoRow[]
}

export async function generarPDFVentasFotos(data: PDFVentasFotosData): Promise<Buffer> {
  try {
    console.log('[PDF Ventas-Fotos] Iniciando generación...')
    console.log('[PDF Ventas-Fotos] Filas:', data.rows.length)

    // Límite de 300 filas para performance en Vercel Pro
    const rowsLimitadas = data.rows.slice(0, 300)
    if (data.rows.length > 300) {
      console.warn('[PDF Ventas-Fotos] Limitando a 300 filas de', data.rows.length)
    }

    // Crear documento
    const pdfDoc = await PDFDocument.create()
    let page = pdfDoc.addPage([595, 842]) // A4
    const { width, height } = page.getSize()

    // Cargar fuentes
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)

    let y = height - 40

    // ========================================
    // PORTADA / HEADER
    // ========================================
    page.drawText('INFORME DE VENTAS CON FOTOS', {
      x: width / 2 - 140,
      y,
      size: 22,
      font: fontBold,
      color: AZUL_NEXUS,
    })
    y -= 20

    page.drawText('NEXUS Report · RIMEC', {
      x: width / 2 - 75,
      y,
      size: 10,
      font: fontRegular,
      color: DORADO_NEXUS,
    })
    y -= 18

    // Línea dorada
    page.drawLine({
      start: { x: 40, y },
      end: { x: width - 40, y },
      thickness: 2,
      color: DORADO_NEXUS,
    })
    y -= 22

    // Información de filtros
    page.drawText(`Cliente: ${data.cliente.id} · ${data.cliente.nombre}`, {
      x: 40,
      y,
      size: 11,
      font: fontBold,
      color: AZUL_NEXUS,
    })
    y -= 14

    page.drawText(`Marca: ${data.marca.descp_marca}`, {
      x: 40,
      y,
      size: 10,
      font: fontRegular,
      color: GRIS_TEXTO,
    })
    y -= 12

    page.drawText(`Período: ${data.filtros.fechaInicio} a ${data.filtros.fechaFin}`, {
      x: 40,
      y,
      size: 10,
      font: fontRegular,
      color: GRIS_TEXTO,
    })
    y -= 12

    page.drawText(`Fecha de generación: ${new Date().toLocaleDateString('es-PY')}`, {
      x: 40,
      y,
      size: 8,
      font: fontRegular,
      color: rgb(0.392, 0.455, 0.545),
    })
    y -= 25

    // KPIs
    page.drawRectangle({
      x: 40,
      y: y - 45,
      width: width - 80,
      height: 50,
      color: GRIS_CLARO,
    })

    const fmtMoney = new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', minimumFractionDigits: 0 })

    page.drawText('KPIs del Período', {
      x: 50,
      y: y - 15,
      size: 10,
      font: fontBold,
      color: AZUL_NEXUS,
    })

    page.drawText(`Total cantidad: ${data.kpis.total_cantidad}`, {
      x: 50,
      y: y - 30,
      size: 9,
      font: fontRegular,
      color: GRIS_TEXTO,
    })

    page.drawText(`Total monto: ${fmtMoney.format(data.kpis.total_monto)}`, {
      x: 200,
      y: y - 30,
      size: 9,
      font: fontRegular,
      color: GRIS_TEXTO,
    })

    page.drawText(`Artículos únicos: ${data.kpis.articulos_unicos}`, {
      x: 380,
      y: y - 30,
      size: 9,
      font: fontRegular,
      color: GRIS_TEXTO,
    })

    y -= 60

    // ========================================
    // TABLA DE VENTAS
    // ========================================

    // Cache de imágenes para no descargar duplicados
    const imageCache = new Map<string, any>()

    for (let i = 0; i < rowsLimitadas.length; i++) {
      const row = rowsLimitadas[i]

      // Verificar espacio para nueva fila
      const rowHeight = 75
      if (y < 100) {
        page = pdfDoc.addPage([595, 842])
        y = height - 40
      }

      const rowY = y - rowHeight

      // Fondo alternado
      if (i % 2 === 0) {
        page.drawRectangle({
          x: 40,
          y: rowY,
          width: width - 80,
          height: rowHeight,
          color: GRIS_CLARO,
        })
      }

      // Imagen (OBLIGATORIA según OT)
      if (row.imagen_valid && row.image_url) {
        try {
          // Verificar si ya tenemos la imagen en cache
          let image = imageCache.get(row.image_url)

          if (!image) {
            // Timeout de 1000ms por imagen para maximizar throughput
            const imgResponse = await safeFetchImage(row.image_url, 1000)

            if (imgResponse) {
              const imgBytes = await imgResponse.arrayBuffer()
              const imgType = row.image_url.toLowerCase()

              if (imgType.endsWith('.png')) {
                image = await pdfDoc.embedPng(imgBytes)
              } else if (imgType.endsWith('.jpg') || imgType.endsWith('.jpeg')) {
                image = await pdfDoc.embedJpg(imgBytes)
              }

              // Guardar en cache
              if (image) {
                imageCache.set(row.image_url, image)
              }
            }
          }

          if (image) {
            const imgSize = 60
            page.drawImage(image, {
              x: 45,
              y: y - 68,
              width: imgSize,
              height: imgSize,
            })
          } else {
            // Placeholder si falla carga
            page.drawRectangle({
              x: 45,
              y: y - 68,
              width: 60,
              height: 60,
              color: rgb(0.9, 0.9, 0.9),
            })
            page.drawText('NO', {
              x: 55,
              y: y - 35,
              size: 7,
              font: fontBold,
              color: rgb(0.6, 0.6, 0.6),
            })
            page.drawText('DISP', {
              x: 52,
              y: y - 45,
              size: 7,
              font: fontBold,
              color: rgb(0.6, 0.6, 0.6),
            })
          }
        } catch (error) {
          console.warn('[PDF] Error cargando imagen:', row.image_url, error)
          // Placeholder
          page.drawRectangle({
            x: 45,
            y: y - 68,
            width: 60,
            height: 60,
            color: rgb(0.9, 0.9, 0.9),
          })
          page.drawText('ERROR', {
            x: 52,
            y: y - 40,
            size: 7,
            font: fontBold,
            color: rgb(0.8, 0.2, 0.2),
          })
        }
      } else {
        // Sin imagen válida
        page.drawRectangle({
          x: 45,
          y: y - 68,
          width: 60,
          height: 60,
          color: rgb(0.95, 0.95, 0.95),
        })
        page.drawText('IMAGEN', {
          x: 48,
          y: y - 35,
          size: 6,
          font: fontRegular,
          color: rgb(0.7, 0.7, 0.7),
        })
        page.drawText('INVÁLIDA', {
          x: 46,
          y: y - 45,
          size: 6,
          font: fontRegular,
          color: rgb(0.7, 0.7, 0.7),
        })
      }

      // Fecha
      page.drawText(row.fecha, {
        x: 115,
        y: y - 12,
        size: 8,
        font: fontRegular,
        color: GRIS_TEXTO,
      })

      // Referencia
      const refTrunc = row.imagen.substring(0, 30)
      page.drawText(`Ref: ${refTrunc}`, {
        x: 115,
        y: y - 22,
        size: 7,
        font: fontRegular,
        color: GRIS_TEXTO,
      })

      // Pilares L-R-M-C
      if (row.imagen_valid) {
        page.drawText(`L${row.linea_codigo} · R${row.referencia_codigo} · M${row.material_codigo} · C${row.color_codigo}`, {
          x: 115,
          y: y - 32,
          size: 6.5,
          font: fontRegular,
          color: rgb(0.392, 0.455, 0.545),
        })
      } else {
        page.drawText('Pilares no disponibles', {
          x: 115,
          y: y - 32,
          size: 6.5,
          font: fontRegular,
          color: rgb(0.8, 0.2, 0.2),
        })
      }

      // Categoría
      const categoriaTrunc = row.descp_categoria ? row.descp_categoria.substring(0, 20) : '—'
      page.drawText(`Cat: ${categoriaTrunc}`, {
        x: 115,
        y: y - 42,
        size: 7,
        font: fontRegular,
        color: GRIS_TEXTO,
      })

      // Cantidad
      page.drawText(`Cant: ${row.cantidad}`, {
        x: 115,
        y: y - 54,
        size: 8,
        font: fontBold,
        color: AZUL_NEXUS,
      })

      // Monto
      page.drawText(fmtMoney.format(row.monto), {
        x: 115,
        y: y - 65,
        size: 9,
        font: fontBold,
        color: DORADO_NEXUS,
      })

      // Tipo venta
      const tipoColor = row.tipo_venta === 'VENTA'
        ? rgb(0.133, 0.545, 0.133) // Verde
        : rgb(0.855, 0.647, 0.125) // Ámbar

      page.drawText(row.tipo_venta, {
        x: width - 120,
        y: y - 25,
        size: 9,
        font: fontBold,
        color: tipoColor,
      })

      // Tipo descripción
      page.drawText(row.desc_tipo || '—', {
        x: width - 120,
        y: y - 38,
        size: 7,
        font: fontRegular,
        color: GRIS_TEXTO,
      })

      y -= rowHeight + 5
    }

    // Footer en todas las páginas
    const pages = pdfDoc.getPages()
    pages.forEach((p, idx) => {
      p.drawText(`Ventas con Fotos — Nexus Report — Página ${idx + 1} de ${pages.length}`, {
        x: width / 2 - 130,
        y: 20,
        size: 8,
        font: fontRegular,
        color: rgb(0.580, 0.639, 0.722),
      })
    })

    console.log('[PDF Ventas-Fotos] Finalizando documento...')
    const pdfBytes = await pdfDoc.save()
    console.log('[PDF Ventas-Fotos] PDF generado exitosamente, size:', pdfBytes.length)

    return Buffer.from(pdfBytes)
  } catch (error) {
    console.error('[PDF Ventas-Fotos] Exception en generación:', error)
    console.error('[PDF Ventas-Fotos] Error stack:', error instanceof Error ? error.stack : 'No stack available')
    console.error('[PDF Ventas-Fotos] Error message:', error instanceof Error ? error.message : String(error))
    throw error
  }
}
