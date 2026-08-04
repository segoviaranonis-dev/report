/**
 * Cliente: descarga PDF / ZIP Sales Report gerencial.
 */
"use client";

import type { RimecPdfMeta } from "./pdf-gerencial";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type DownloadPdfInput = {
  title: string;
  rows: Record<string, unknown>[];
  groupCols?: string[];
  columns?: string[];
  meta?: RimecPdfMeta;
  showTotal?: boolean;
  filename?: string;
};

export async function downloadRimecPdf(input: DownloadPdfInput): Promise<void> {
  if (!input.rows.length) throw new Error("Sin datos para PDF");
  const res = await fetch("/api/rimec/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `PDF falló (${res.status})`);
  }
  const blob = await res.blob();
  const name =
    input.filename ??
    `${input.title.replace(/[^\w\-]+/g, "_").slice(0, 60) || "informe"}.pdf`;
  triggerDownload(blob, name);
}

export type DownloadBatchInput = {
  titlePrefix: string;
  rows: Record<string, unknown>[];
  batchCol: string;
  groupCols?: string[];
  columns?: string[];
  meta?: RimecPdfMeta;
  filename?: string;
};

export async function downloadRimecBatchZip(input: DownloadBatchInput): Promise<{ count: number }> {
  if (!input.rows.length) throw new Error("Sin datos para batch PDF");
  const res = await fetch("/api/rimec/batch-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `Batch PDF falló (${res.status})`);
  }
  const count = Number(res.headers.get("X-Rimec-Pdf-Count") ?? "0");
  const blob = await res.blob();
  const name = input.filename ?? `batch_${input.batchCol.toLowerCase()}.zip`;
  triggerDownload(blob, name);
  return { count };
}
