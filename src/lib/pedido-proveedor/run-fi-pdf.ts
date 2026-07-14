import fs from "node:fs";
import path from "node:path";
import { fetchFiPdfPayload } from "@/lib/pedido-proveedor/fi-pdf-data";
import { generarPDFFactura } from "@/lib/pedido-proveedor/fi-pdf-generator";
import { runFiPdfPython, type FiPdfResult } from "@/lib/pedido-proveedor/run-python-fi-pdf";

export type { FiPdfResult };

const CONTROL_CENTRAL = path.resolve(process.cwd(), "..", "control_central");
const PYTHON_SCRIPT = path.join(CONTROL_CENTRAL, "generar_pdf_cli.py");

function pythonAvailable(): boolean {
  if (process.env.VERCEL === "1" || process.env.VERCEL === "true") return false;
  try {
    return fs.existsSync(PYTHON_SCRIPT);
  } catch {
    return false;
  }
}

async function runFiPdfNode(fiId: number, filenameHint?: string): Promise<FiPdfResult> {
  try {
    const payload = await fetchFiPdfPayload(fiId);
    if (!payload) {
      return { ok: false, error: "Factura interna no encontrada o sin ítems" };
    }

    const buffer = await generarPDFFactura(payload.pvData, payload.items);
    if (!buffer.length) {
      return { ok: false, error: "PDF vacío" };
    }

    const safe = (filenameHint || payload.pvData.pv_numero || `FI_${fiId}`).replace(
      /[^\w.-]+/g,
      "_",
    );
    return { ok: true, buffer, filename: `${safe}.pdf` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error generando PDF";
    console.error("[FI PDF Node]", msg, e);
    return { ok: false, error: msg };
  }
}

/** Genera PDF FI — Node/pdf-lib en prod; Python solo fallback local si existe script. */
export async function runFiPdf(fiId: number, filenameHint?: string): Promise<FiPdfResult> {
  const nodeResult = await runFiPdfNode(fiId, filenameHint);
  if (nodeResult.ok) return nodeResult;

  if (pythonAvailable()) {
    console.warn("[FI PDF] Node falló, intentando Python local:", nodeResult.error);
    const pyResult = await runFiPdfPython(fiId, filenameHint);
    if (pyResult.ok) return pyResult;
    return {
      ok: false,
      error: pyResult.error || nodeResult.error,
    };
  }

  return nodeResult;
}
