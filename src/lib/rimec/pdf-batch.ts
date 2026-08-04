/**
 * Batch ZIP PDF gerencial — paridad Streamlit `export_batch_zip`.
 */
import JSZip from "jszip";
import {
  generateRimecGerencialPdf,
  type RimecPdfMeta,
  type RimecPdfOptions,
} from "./pdf-gerencial";

export type RimecBatchPdfOptions = {
  titlePrefix: string;
  rows: Record<string, unknown>[];
  /** Columna por la que se parte el lote (1 PDF por valor único). */
  batchCol: string;
  groupCols?: string[];
  columns?: string[];
  meta?: RimecPdfMeta;
  showTotal?: boolean;
  maxLeafRows?: number;
  /** Tope de PDFs en el ZIP (protección). */
  maxFiles?: number;
};

function safeName(v: string): string {
  return v.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_").slice(0, 80) || "item";
}

export async function generateRimecBatchZip(
  opts: RimecBatchPdfOptions,
): Promise<{ zip: Uint8Array; count: number; skipped: number }> {
  const rows = opts.rows ?? [];
  if (!rows.length) throw new Error("Sin filas para batch PDF");
  if (!opts.batchCol) throw new Error("batchCol requerido");

  const values = [...new Set(rows.map((r) => String(r[opts.batchCol] ?? "").trim() || "S/D"))];
  const maxFiles = opts.maxFiles ?? 80;
  const zip = new JSZip();
  let count = 0;
  let skipped = 0;

  for (const item of values) {
    if (count >= maxFiles) {
      skipped += 1;
      continue;
    }
    const filtered = rows.filter((r) => (String(r[opts.batchCol] ?? "").trim() || "S/D") === item);
    if (!filtered.length) continue;
    const pdfOpts: RimecPdfOptions = {
      title: `${opts.titlePrefix}: ${item}`,
      rows: filtered,
      groupCols: opts.groupCols,
      columns: opts.columns,
      meta: opts.meta,
      showTotal: opts.showTotal,
      maxLeafRows: opts.maxLeafRows,
      mode: "gerencial",
    };
    const bytes = await generateRimecGerencialPdf(pdfOpts);
    zip.file(`${safeName(item)}.pdf`, bytes);
    count += 1;
  }

  if (!count) throw new Error("Batch sin PDFs generados");
  const zipBytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return { zip: zipBytes, count, skipped: skipped + Math.max(0, values.length - maxFiles - skipped) };
}
