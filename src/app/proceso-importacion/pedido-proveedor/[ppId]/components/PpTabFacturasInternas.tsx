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
import { CATEGORIA_PROGRAMADO_ID } from "@/lib/intencion-compra/categoria-ic";
import { ProcesoImportacionWaitOverlay } from "@/components/report/ProcesoImportacionWaitOverlay";
import { PpFiCard } from "./PpFiCard";

const FI_BATCH = 12;

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
  const esProgramado = pp.categoria_id === CATEGORIA_PROGRAMADO_ID;
  const [csvLoading, setCsvLoading] = useState(false);
  const [fiBusy, setFiBusy] = useState(false);
  const [fiProgress, setFiProgress] = useState("");
  const [proformaFile, setProformaFile] = useState<File | null>(null);
  const [fiEstado, setFiEstado] = useState<{
    n_ic: number;
    n_fi: number;
    has_snapshot: boolean;
    needs_proforma_file: boolean;
  } | null>(null);

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

  const mostrarCrearFi =
    esProgramado &&
    editable &&
    pp.total_articulos > 0 &&
    (pp.n_facturas_internas === 0 || (fiEstado != null && fiEstado.n_fi < fiEstado.n_ic));

  useEffect(() => {
    if (!esProgramado || pp.total_articulos === 0) {
      setFiEstado(null);
      return;
    }
    fetch(`/api/proceso-importacion/pedido-proveedor/${pp.id}/completar-fi`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setFiEstado({
            n_ic: Number(d.n_ic ?? 0),
            n_fi: Number(d.n_fi ?? 0),
            has_snapshot: Boolean(d.has_snapshot),
            needs_proforma_file: Boolean(d.needs_proforma_file),
          });
        }
      })
      .catch(() => setFiEstado(null));
  }, [esProgramado, pp.id, pp.total_articulos, pp.n_facturas_internas]);

  useEffect(() => {
    if (facturasUnicas.length === 0) return;
    return prefetchPpFiDownloads(
      ppIdNum,
      facturasUnicas.map((f) => f.id),
      { csv: puedeCsv, pdfConcurrency: 1, delayMs: 700, pdfPriorityCount: 2 },
    );
  }, [ppIdNum, facturasUnicas, puedeCsv]);

  async function postCompletarFi(fd: FormData) {
    const res = await fetch(`/api/proceso-importacion/pedido-proveedor/${pp.id}/completar-fi`, {
      method: "POST",
      credentials: "same-origin",
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al crear FI");
    return data as Record<string, unknown>;
  }

  async function crearFacturasInternas() {
    if (fiEstado?.needs_proforma_file && !proformaFile) {
      onMsg("Subí el Excel de proforma una vez — guarda el mapa SHOP↔IC para las 98 FI.");
      return;
    }
    setFiBusy(true);
    setFiProgress("");
    onMsg("");
    try {
      let offset = fiEstado?.n_fi ?? pp.n_facturas_internas ?? 0;
      let data: Record<string, unknown> = { done: false };
      const totalIc = fiEstado?.n_ic ?? "?";

      while (!data.done) {
        setFiProgress(`Creando FI… ${Math.min(offset + FI_BATCH, Number(totalIc) || offset + FI_BATCH)}/${totalIc}`);
        const fd = new FormData();
        if (proformaFile && (fiEstado?.needs_proforma_file || offset === 0)) {
          fd.append("file", proformaFile);
        }
        fd.append("fi_offset", String(offset));
        fd.append("fi_batch", String(FI_BATCH));
        data = await postCompletarFi(fd);
        if (data.done) break;
        const next = Number(data.fi_offset_next);
        if (!Number.isFinite(next) || next <= offset) {
          throw new Error(`FI incompletas (${Number(data.n_fi ?? 0)}/${Number(data.fi_total ?? totalIc)})`);
        }
        offset = next;
      }

      onMsg(
        `Facturas internas creadas · ${Number(data.n_fi ?? 0)} FI · cabecera = IC · saldo PP actualizado.`,
      );
      setProformaFile(null);
      await onReload();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setFiBusy(false);
      setFiProgress("");
    }
  }

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
      <ProcesoImportacionWaitOverlay
        open={fiBusy}
        title="Creando facturas internas…"
        detail={`${pp.numero_registro} · 1 FI por IC`}
        hint={fiProgress || "Lotes de 12 · no cierres la pestaña"}
      />
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

      {mostrarCrearFi && (
        <div className="rounded-xl border-2 border-violet-400 bg-violet-50 px-5 py-4">
          <p className="text-base font-extrabold text-violet-950">Crear facturas internas desde las IC</p>
          <p className="mt-1 text-sm text-violet-900">
            Stock importado ({pp.total_articulos} moléculas) ·{" "}
            <strong>{fiEstado?.n_ic ?? "—"} IC</strong> esperan su FI · saldo PP = 0 hasta completar.
          </p>
          {fiEstado?.needs_proforma_file && (
            <label className="mt-3 block text-xs font-semibold text-violet-900">
              Excel proforma (solo la primera vez — guarda mapa SHOP)
              <input
                type="file"
                accept=".xls,.xlsx"
                className="mt-1 block w-full max-w-md text-sm"
                disabled={fiBusy}
                onChange={(e) => setProformaFile(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
          <button
            type="button"
            disabled={fiBusy || (fiEstado?.needs_proforma_file && !proformaFile)}
            onClick={() => void crearFacturasInternas()}
            className="mt-4 rounded-xl bg-violet-700 px-6 py-3 text-sm font-extrabold text-white shadow hover:bg-violet-800 disabled:opacity-50"
          >
            {fiBusy ? "Creando FI…" : `Crear ${fiEstado?.n_ic ?? ""} facturas internas`}
          </button>
        </div>
      )}

      {facturasUnicas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
          {esProgramado && pp.total_articulos > 0
            ? "Sin FI aún — usá el bloque violeta arriba (1 FI por IC)."
            : "Sin FI aún. Importá proforma en tab Stock (preview SHOP↔IC → confirmar)."}
        </div>
      ) : (
        facturasUnicas.map((fi) => (
          <PpFiCard
            key={fi.id}
            fi={fi}
            ppId={ppIdNum}
            programado={esProgramado}
            editable={editable}
            detalles={detallesPorFi[fi.id] ?? []}
            onUpdated={onReload}
            onMsg={onMsg}
          />
        ))
      )}
    </section>
  );
}
