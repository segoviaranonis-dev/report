"use client";

import { useState } from "react";
import { FileDown, Files } from "lucide-react";
import {
  downloadRimecBatchZip,
  downloadRimecPdf,
} from "@/lib/rimec/pdf-download-client";
import type { RimecPdfMeta } from "@/lib/rimec/pdf-gerencial";

type Props = {
  title: string;
  rows: Record<string, unknown>[];
  groupCols?: string[];
  meta?: RimecPdfMeta;
  showTotal?: boolean;
  /** Si hay batchCol → muestra botón BATCH PDF (ZIP). */
  batchCol?: string;
  batchTitlePrefix?: string;
  batchGroupCols?: string[];
  className?: string;
  /** Paridad Streamlit: outline junto a AMPLIAR. */
  variant?: "solid" | "outline";
};

export function PdfExportBar({
  title,
  rows,
  groupCols,
  meta,
  showTotal = true,
  batchCol,
  batchTitlePrefix,
  batchGroupCols,
  className = "",
  variant = "solid",
}: Props) {
  const [busy, setBusy] = useState<"pdf" | "batch" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const runPdf = async () => {
    setErr(null);
    setOk(null);
    setBusy("pdf");
    try {
      await downloadRimecPdf({ title, rows, groupCols, meta, showTotal });
      setOk("PDF listo");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error PDF");
    } finally {
      setBusy(null);
    }
  };

  const runBatch = async () => {
    if (!batchCol) return;
    setErr(null);
    setOk(null);
    setBusy("batch");
    try {
      const { count } = await downloadRimecBatchZip({
        titlePrefix: batchTitlePrefix ?? title,
        rows,
        batchCol,
        groupCols: batchGroupCols ?? groupCols,
        meta,
        filename: `batch_${batchCol.toLowerCase()}.zip`,
      });
      setOk(`ZIP · ${count} PDF`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error batch");
    } finally {
      setBusy(null);
    }
  };

  const btnPdf =
    variant === "outline"
      ? "inline-flex items-center gap-1.5 rounded-lg border border-rimec-azul/40 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-rimec-azul transition hover:bg-rimec-azul/5 disabled:opacity-40"
      : "inline-flex items-center gap-1.5 rounded-lg border border-rimec-azul/30 bg-rimec-azul px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white transition hover:bg-rimec-azul/90 disabled:opacity-40";

  return (
    <div className={`flex flex-wrap items-center gap-2 print:hidden ${className}`}>
      <button
        type="button"
        disabled={!rows.length || busy !== null}
        onClick={() => void runPdf()}
        className={btnPdf}
        title="Descargar PDF gerencial (paridad Streamlit)"
      >
        <FileDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {busy === "pdf" ? "Generando…" : "PDF"}
      </button>
      {batchCol ? (
        <button
          type="button"
          disabled={!rows.length || busy !== null}
          onClick={() => void runBatch()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-rimec-azul/25 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-rimec-azul transition hover:bg-rimec-azul/5 disabled:opacity-40"
          title={`1 PDF por ${batchCol} · ZIP (máx 80)`}
        >
          <Files className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {busy === "batch" ? "Lote…" : "BATCH PDF"}
        </button>
      ) : null}
      {err ? <span className="text-[10px] text-red-600">{err}</span> : null}
      {ok && !err ? <span className="text-[10px] text-semantic-success">{ok}</span> : null}
    </div>
  );
}
