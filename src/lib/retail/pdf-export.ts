/**
 * Utilidades para exportar reportes Retail a PDF
 * Usa jsPDF + html2canvas para capturar contenido visual
 * Diseño visual alineado a la identidad RIMEC
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { RetailStockBoardResponse } from './types';

// Colores del tema RIMEC
const COLORS = {
  navy: [30, 58, 95] as [number, number, number],      // #1e3a5f - report-navy
  navy2: [45, 75, 115] as [number, number, number],     // report-navy2
  ink: [51, 51, 51] as [number, number, number],        // #333 - report-ink
  muted: [115, 115, 115] as [number, number, number],   // #737373
  paper: [250, 248, 245] as [number, number, number],   // #faf8f5
  rule: [218, 210, 200] as [number, number, number],    // #dad2c8
};

/**
 * Dibuja header RIMEC en todas las páginas
 */
function dibujarHeader(pdf: jsPDF, titulo: string, subtitulo?: string) {
  const pageWidth = pdf.internal.pageSize.getWidth();

  // Fondo del header
  pdf.setFillColor(...COLORS.navy);
  pdf.rect(0, 0, pageWidth, 25, 'F');

  // Título
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(titulo, pageWidth / 2, 12, { align: 'center' });

  // Subtítulo
  if (subtitulo) {
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(subtitulo, pageWidth / 2, 19, { align: 'center' });
  }

  // Línea decorativa
  pdf.setDrawColor(...COLORS.rule);
  pdf.setLineWidth(0.5);
  pdf.line(0, 25, pageWidth, 25);
}

/**
 * Dibuja footer en todas las páginas
 */
function dibujarFooter(pdf: jsPDF, pageNum: number, totalPages: number) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Línea superior del footer
  pdf.setDrawColor(...COLORS.rule);
  pdf.setLineWidth(0.3);
  pdf.line(15, pageHeight - 15, pageWidth - 15, pageHeight - 15);

  // Texto del footer
  pdf.setTextColor(...COLORS.muted);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');

  const fecha = new Date().toLocaleDateString('es-PY', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  pdf.text(`RIMEC · Informe Retail`, 15, pageHeight - 10);
  pdf.text(`${fecha}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  pdf.text(`Pág. ${pageNum} de ${totalPages}`, pageWidth - 15, pageHeight - 10, { align: 'right' });
}

/**
 * Exporta el catálogo de productos (tarjetas visuales) a PDF
 * Layout: 3 filas × 3 columnas = 9 tarjetas por página
 *
 * @param renderBatch - Función callback para renderizar un batch de tarjetas
 * @param totalColumnas - Total de columnas disponibles
 * @param batchLabel - Etiqueta del lote
 */
export async function exportarCatalogoPDF(
  renderBatch: (startIdx: number, count: number) => Promise<void>,
  totalColumnas: number,
  batchLabel: string
): Promise<void> {
  try {
    const pdf = new jsPDF('p', 'mm', 'a4'); // 'p' = portrait (vertical)
    const pageWidth = pdf.internal.pageSize.getWidth(); // ~210mm
    const pageHeight = pdf.internal.pageSize.getHeight(); // ~297mm

    const margin = 8; // Márgenes más pequeños para aprovechar espacio
    const headerHeight = 25;
    const footerHeight = 15;
    const availableHeight = pageHeight - headerHeight - footerHeight;
    const availableWidth = pageWidth - (margin * 2);

    const BATCH_SIZE = 6; // 2 filas × 3 columnas
    const totalPages = Math.ceil(totalColumnas / BATCH_SIZE);
    let pageNum = 0;

    for (let startIdx = 0; startIdx < totalColumnas; startIdx += BATCH_SIZE) {
      pageNum++;
      const count = Math.min(BATCH_SIZE, totalColumnas - startIdx);

      // Renderizar batch en el contenedor oculto
      await renderBatch(startIdx, count);

      // Esperar MÁS tiempo para que todo se renderice correctamente
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Capturar desde contenedor OPTIMIZADO para PDF
      const element = document.getElementById('pdf-optimized-container');
      if (!element) {
        throw new Error('Contenedor PDF optimizado no encontrado');
      }

      const canvas = await html2canvas(element, {
        scale: 2.0,
        useCORS: true,
        logging: false,
        backgroundColor: '#faf8f5',
        width: 1600,
        allowTaint: true, // Permitir imágenes cross-origin
      });

      const imgData = canvas.toDataURL('image/png');

      // Agregar página si no es la primera
      if (pageNum > 1) {
        pdf.addPage();
      }

      // Header
      dibujarHeader(pdf, 'Reporte Ventas - Stock', batchLabel);

      // Calcular dimensiones para LLENAR la página disponible
      const imgAspectRatio = canvas.width / canvas.height;

      // Intentar llenar el ancho disponible
      let imgWidth = availableWidth;
      let imgHeight = imgWidth / imgAspectRatio;

      // Si la altura excede, ajustar por altura
      if (imgHeight > availableHeight) {
        imgHeight = availableHeight;
        imgWidth = imgHeight * imgAspectRatio;
      }

      // Centrar horizontalmente y verticalmente
      const xPos = margin + (availableWidth - imgWidth) / 2;
      const yPos = headerHeight + (availableHeight - imgHeight) / 2;

      // Agregar imagen MAXIMIZANDO el espacio
      pdf.addImage(imgData, 'PNG', xPos, yPos, imgWidth, imgHeight);

      // Footer temporal
      dibujarFooter(pdf, pageNum, totalPages);
    }

    // Actualizar footers con numeración correcta
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      dibujarFooter(pdf, i, totalPages);
    }

    // Descargar
    const fecha = new Date().toISOString().split('T')[0];
    const filename = `RIMEC_Reporte_Stock_${batchLabel.replace(/\s+/g, '_')}_${fecha}.pdf`;
    pdf.save(filename);
  } catch (error) {
    console.error('Error exportando catálogo PDF:', error);
    throw error;
  }
}

/**
 * Exporta el análisis de ventas (KPIs + tablas) a PDF
 */
export async function exportarAnalisisPDF(
  kpis: NonNullable<RetailStockBoardResponse['kpis']>,
  batchLabel: string,
  filtrosAplicados?: string
): Promise<void> {
  try {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 15;

    // Header
    dibujarHeader(pdf, 'Análisis de Ventas · Retail', batchLabel);

    let yPos = 35;

    // Metadatos del reporte
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...COLORS.muted);

    const fecha = new Date().toLocaleDateString('es-PY', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    pdf.text(`Fecha de generación: ${fecha}`, margin, yPos);
    yPos += 5;

    if (filtrosAplicados) {
      pdf.text(`Filtros aplicados: ${filtrosAplicados}`, margin, yPos);
      yPos += 5;
    }

    yPos += 8;

    // Separador
    pdf.setDrawColor(...COLORS.rule);
    pdf.setLineWidth(0.3);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    // Título de sección
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...COLORS.navy);
    pdf.text('INDICADORES CLAVE', margin, yPos);
    yPos += 10;

    // KPIs en cajas con diseño
    const kpiDefinitions = [
      {
        label: 'Pares en red',
        sublabel: 'Stock tiendas',
        value: kpis.paresEnRed,
        icon: '📦',
      },
      {
        label: 'Referencias',
        sublabel: 'SKU activos',
        value: kpis.referenciasActivas,
        icon: '🏷️',
      },
      {
        label: 'Venta total',
        sublabel: 'Pares vendidos',
        value: kpis.paresVentaTotal,
        icon: '💰',
      },
      {
        label: 'Stock importadora',
        sublabel: 'Pares disponibles',
        value: kpis.paresImportadora,
        icon: '🏭',
      },
      {
        label: 'Pilares OK',
        sublabel: 'Filas validadas',
        value: kpis.filasPilaresOk,
        icon: '✓',
      },
      {
        label: 'Pilares pendientes',
        sublabel: 'Filas por validar',
        value: kpis.filasPilaresPendientes,
        icon: '⚠',
      },
    ];

    const kpiWidth = (pageWidth - margin * 2 - 10) / 2; // 2 columnas
    const kpiHeight = 22;
    let col = 0;
    let row = 0;

    kpiDefinitions.forEach((kpi, index) => {
      const x = margin + (col * (kpiWidth + 5));
      const y = yPos + (row * (kpiHeight + 5));

      // Caja con borde
      pdf.setDrawColor(...COLORS.rule);
      pdf.setFillColor(...COLORS.paper);
      pdf.roundedRect(x, y, kpiWidth, kpiHeight, 2, 2, 'FD');

      // Icono
      pdf.setFontSize(14);
      pdf.text(kpi.icon, x + 4, y + 8);

      // Label
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...COLORS.ink);
      pdf.text(kpi.label, x + 12, y + 7);

      // Sublabel
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...COLORS.muted);
      pdf.text(kpi.sublabel, x + 12, y + 11);

      // Valor
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...COLORS.navy);
      const valorFormateado = kpi.value.toLocaleString('es-PY');
      pdf.text(valorFormateado, x + kpiWidth - 4, y + 15, { align: 'right' });

      col++;
      if (col === 2) {
        col = 0;
        row++;
      }
    });

    yPos += Math.ceil(kpiDefinitions.length / 2) * (kpiHeight + 5) + 10;

    // Separador
    pdf.setDrawColor(...COLORS.rule);
    pdf.setLineWidth(0.3);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    // Sección de detalles
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...COLORS.navy);
    pdf.text('DETALLES DEL ANÁLISIS', margin, yPos);
    yPos += 8;

    // Tabla de detalles
    const detalles = [
      ['Lote analizado', batchLabel],
      ['Total referencias activas', kpis.referenciasActivas.toLocaleString('es-PY') + ' SKU'],
      ['Stock total en red', kpis.paresEnRed.toLocaleString('es-PY') + ' pares'],
      ['Venta acumulada', kpis.paresVentaTotal.toLocaleString('es-PY') + ' pares'],
      ['Stock importadora', kpis.paresImportadora.toLocaleString('es-PY') + ' pares'],
      [
        'Validación pilares',
        `${kpis.filasPilaresOk.toLocaleString('es-PY')} OK / ${kpis.filasPilaresPendientes.toLocaleString('es-PY')} pendientes`,
      ],
    ];

    pdf.setFontSize(9);
    detalles.forEach(([label, value]) => {
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...COLORS.muted);
      pdf.text(label, margin + 2, yPos);

      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...COLORS.ink);
      pdf.text(value, margin + 70, yPos);

      yPos += 6;
    });

    yPos += 8;

    // Nota explicativa
    pdf.setFillColor(245, 245, 250);
    pdf.roundedRect(margin, yPos, pageWidth - margin * 2, 25, 2, 2, 'F');

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...COLORS.navy);
    pdf.text('📋 Nota técnica', margin + 4, yPos + 5);

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...COLORS.ink);
    pdf.setFontSize(7.5);
    const nota1 = 'Los datos provienen del snapshot completo del Excel st+vt+RC (Stock/Venta/Reposición/Compra).';
    const nota2 = 'Pilares: Línea, Referencia, Material, Color validados contra maestros. Grada por talla.';
    const nota3 = 'Stock en red: sumatoria de stock en todas las tiendas (tipo Stock). Importadora: stock central.';

    pdf.text(nota1, margin + 4, yPos + 10, { maxWidth: pageWidth - margin * 2 - 8 });
    pdf.text(nota2, margin + 4, yPos + 15, { maxWidth: pageWidth - margin * 2 - 8 });
    pdf.text(nota3, margin + 4, yPos + 20, { maxWidth: pageWidth - margin * 2 - 8 });

    // Footer
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      dibujarFooter(pdf, i, totalPages);
    }

    // Descargar
    const fechaArchivo = new Date().toISOString().split('T')[0];
    const filename = `RIMEC_Analisis_Retail_${batchLabel.replace(/\s+/g, '_')}_${fechaArchivo}.pdf`;
    pdf.save(filename);
  } catch (error) {
    console.error('Error exportando análisis PDF:', error);
    throw error;
  }
}