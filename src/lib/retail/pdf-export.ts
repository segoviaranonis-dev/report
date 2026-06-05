/**
 * Utilidades para exportar reportes Retail a PDF
 * Usa jsPDF + html2canvas para capturar contenido visual
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { RetailStockBoardResponse } from './types';

/**
 * Exporta el catálogo de productos (tarjetas visuales) a PDF
 */
export async function exportarCatalogoPDF(
  elementId: string,
  batchLabel: string
): Promise<void> {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error('Elemento no encontrado para exportar');
    }

    // Capturar elemento como imagen
    const canvas = await html2canvas(element, {
      scale: 2, // Mejor calidad
      useCORS: true, // Para imágenes externas
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');

    // Crear PDF en orientación portrait
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pdfWidth - 20; // Margen 10mm cada lado
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 10; // Margen superior

    // Agregar título
    pdf.setFontSize(16);
    pdf.text(`Catálogo Retail - ${batchLabel}`, pdfWidth / 2, position, { align: 'center' });
    position += 10;

    // Agregar imagen(es) con paginación si es necesario
    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= (pdfHeight - position);

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    // Descargar
    const filename = `Catalogo_Retail_${batchLabel.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
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
    let yPos = 20;

    // Título
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Análisis de Ventas - Retail', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Subtítulo
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text(batchLabel, pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;

    if (filtrosAplicados) {
      pdf.setFontSize(10);
      pdf.setTextColor(100);
      pdf.text(filtrosAplicados, pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;
    }

    pdf.setTextColor(0);
    yPos += 5;

    // KPIs principales
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Indicadores Clave', 15, yPos);
    yPos += 8;

    // Tabla de KPIs
    const kpiData = [
      ['Pares en red (stock tiendas)', kpis.paresEnRed.toLocaleString('es-PY')],
      ['Referencias (SKU)', kpis.referenciasActivas.toLocaleString('es-PY')],
      ['Filas pilares OK', kpis.filasPilaresOk.toLocaleString('es-PY')],
      ['Filas pilares pendientes', kpis.filasPilaresPendientes.toLocaleString('es-PY')],
      ['Stock importadora', kpis.paresImportadora.toLocaleString('es-PY')],
      ['Venta total (pares)', kpis.paresVentaTotal.toLocaleString('es-PY')],
    ];

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);

    kpiData.forEach(([label, value]) => {
      pdf.text(label, 20, yPos);
      pdf.setFont('helvetica', 'bold');
      pdf.text(value, pageWidth - 20, yPos, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
      yPos += 7;
    });

    // Pie de página
    const pageCount = pdf.getNumberOfPages();
    pdf.setFontSize(9);
    pdf.setTextColor(150);
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.text(
        `Generado: ${new Date().toLocaleString('es-PY')} | Página ${i} de ${pageCount}`,
        pageWidth / 2,
        pdf.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    // Descargar
    const filename = `Analisis_Retail_${batchLabel.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(filename);
  } catch (error) {
    console.error('Error exportando análisis PDF:', error);
    throw error;
  }
}