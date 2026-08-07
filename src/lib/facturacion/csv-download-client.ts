/**
 * Descarga CSV facturación — parseo de error API (incl. Nivel Dios rentabilidad).
 */
import {
  isPeCsvRentabilidadDiosError,
  mensajeUiRentabilidadDios,
} from "@/lib/facturacion/csv-pe-rentabilidad-error";

type CsvErrorPayload = {
  error?: string;
  code?: string;
  severity?: string;
  title?: string;
  impacto?: string;
};

export async function fetchCsvFacturacionBlob(nroFactura: string): Promise<{
  blob: Blob;
  filename: string;
}> {
  const res = await fetch(`/api/facturacion/${encodeURIComponent(nroFactura)}/csv`, {
    credentials: "same-origin",
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as CsvErrorPayload;
    if (data.severity === "NIVEL_DIOS_RENTABILIDAD" || data.code === "4.00.02.009") {
      throw new Error(mensajeUiRentabilidadDios(data));
    }
    throw new Error(data.error || `Error al descargar CSV (${res.status})`);
  }
  const blob = await res.blob();
  const disp = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(disp);
  const filename = match?.[1] ?? "factura.csv";
  return { blob, filename };
}

export function triggerCsvDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function descargarCsvFacturacionPorNro(nroFactura: string): Promise<void> {
  const { blob, filename } = await fetchCsvFacturacionBlob(nroFactura);
  triggerCsvDownload(blob, filename);
}

export { isPeCsvRentabilidadDiosError, mensajeUiRentabilidadDios };
