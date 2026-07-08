"use client";

import { useEffect, useMemo, useState } from "react";
import type { FiDetalle } from "@/app/aprobaciones/lib/aprobaciones-types";
import type { PpDetalleHeader, PpFacturaInternaRow } from "@/lib/pedido-proveedor/detail-query";
import {
  fetchCsvBlob,
  getCachedCsv,
  prefetchPpFiDownloads,
  triggerBlobDownload,
} from "@/lib/pedido-proveedor/fi-download-cache";
import { csvCarlosFilename } from "@/lib/pedido-proveedor/csv-ventas-export";
import { PpFiCard } from "./PpFiCard";

type Props = {
  pp: PpDetalleHeader;
  ppId: string;
  facturas: PpFacturaInternaRow[];
  detallesPorFi: Record<number, FiDetalle[]>;
  onReload: () => void;
  onMsg: (text: string) => void;
};

export function PpTabFacturasInternas({ pp, ppId, facturas, detallesPorFi, onReload, onMsg }: Props) {
  const editable = pp.listado_editable;
  const [csvLoading, setCsvLoading] = useState(false);

  const facturasUnicas = useMemo(() => {
    const seen = new Set<number>();
    return facturas.filter((fi) => {
      if (seen.has(fi.id)) return false;
      seen.add(fi.id);
      return true;
    });
  }, [facturas]);

  const ppIdNum = Number(ppId);
  const puedeCsv =
    pp.categoria_id === 3 ? facturasUnicas.length > 0 : pp.n_fi_confirmadas > 0;

  useEffect(() => {
    if (facturasUnicas.length === 0) return;
    return prefetchPpFiDownloads(
      ppIdNum,
      facturasUnicas.map((f) => f.id),
      { csv: puedeCsv, pdfConcurrency: 1, delayMs: 700, pdfPriorityCount: 2 },
    );
  }, [ppIdNum, facturasUnicas, puedeCsv]);

  async function descargarCsv() {
    setCsvLoading(true);
    try {
      const blob = getCachedCsv(ppIdNum) ?? (await fetchCsvBlob(ppIdNum));
      if (!blob) throw new Error("Error CSV");
      triggerBlobDownload(blob, csvCarlosFilename(pp.numero_proforma, pp.numero_registro));
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Error CSV");
    } finally {
      setCsvLoading(false);
    }
  }

  return (
    <section className="mt-4 space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-sm font-bold text-rimec-azul-dark">
            Ala Sur · Facturas internas ({facturasUnicas.length})
          </h2>
          {(pp.categoria_id === 3 ? facturasUnicas.length > 0 : pp.n_fi_confirmadas > 0) && (
            <button
              type="button"
              disabled={csvLoading}
              onClick={descargarCsv}
              title="CSV veneno Carlos · formato 8604-26"
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
            >
              {csvLoading ? "Generando…" : "📄 CSV"}
            </button>
          )}
        </div>
        {pp.categoria_id === 3 && (
          <p className="mt-1 text-xs text-violet-900">
            PROGRAMADO · 1 FI por IC (SHOP = id_cliente) · LP desde IC · miniaturas L-R-M-C · recalc al cambiar tier.
          </p>
        )}
        {!editable && (
          <p className="mt-2 text-xs font-bold text-amber-800">PP ENVIADO — FI en solo lectura.</p>
        )}
      </div>

      {facturasUnicas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
          Sin FI aún. Importá proforma en tab Stock (preview SHOP↔IC → confirmar).
        </div>
      ) : (
        facturasUnicas.map((fi) => (
          <PpFiCard
            key={fi.id}
            fi={fi}
            ppId={Number(ppId)}
            programado={pp.categoria_id === 3}
            detalles={detallesPorFi[fi.id] ?? []}
            editable={editable}
            onUpdated={onReload}
            onMsg={onMsg}
          />
        ))
      )}
    </section>
  );
}
