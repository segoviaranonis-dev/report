/**
 * Generación SIMPLE de PDF - sin complicaciones
 * Usa el enfoque más directo que funciona
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export async function generarPDFSimple(batchLabel: string) {
  try {
    // Obtener el board visible con TODAS las tarjetas
    const board = document.getElementById('retail-stock-board');
    if (!board) {
      throw new Error('Board no encontrado');
    }

    // Capturar DIRECTAMENTE lo visible
    const canvas = await html2canvas(board, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#faf8f5',
    });

    // Crear PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgData = canvas.toDataURL('image/png');

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Calcular dimensiones manteniendo proporción
    const imgWidth = pageWidth - 20; // 10mm margen cada lado
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Si cabe en una página, ponerlo todo
    if (imgHeight <= pageHeight - 20) {
      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
    } else {
      // Si no cabe, dividir en páginas
      let y = 0;
      while (y < imgHeight) {
        if (y > 0) pdf.addPage();

        const sourceY = (y / imgHeight) * canvas.height;
        const sourceHeight = Math.min(
          ((pageHeight - 20) / imgHeight) * canvas.height,
          canvas.height - sourceY
        );

        pdf.addImage(
          imgData,
          'PNG',
          10,
          10,
          imgWidth,
          (sourceHeight * imgHeight) / canvas.height,
          undefined,
          'FAST',
          0,
          -y + 10
        );

        y += pageHeight - 20;
      }
    }

    // Descargar
    const fecha = new Date().toISOString().split('T')[0];
    pdf.save(`RIMEC_Stock_${batchLabel.replace(/\s+/g, '_')}_${fecha}.pdf`);

    return true;
  } catch (error) {
    console.error('Error generando PDF:', error);
    throw error;
  }
}
