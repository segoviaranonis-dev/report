"use client";

import { useEffect, useMemo, useState } from "react";
import type { FiDetalle } from "@/app/aprobaciones/lib/aprobaciones-types";
import type { IcCatalogos } from "@/lib/intencion-compra/ic-catalogos-types";
import type { PpDetalleHeader, PpFacturaInternaRow } from "@/lib/pedido-proveedor/detail-query";
import {
  clearCachedCsv,
  prefetchPpFiDownloads,
  triggerBlobDownload,
} from "@/lib/pedido-proveedor/fi-download-cache";
import { csvCarlosFilename, csvCarlosInicialFilename } from "@/lib/pedido-proveedor/csv-ventas-export";
import {
  ejecutarRatificarFiProgramado,
  resumenRatificarFi,
} from "@/lib/pedido-proveedor/ratificar-fi-programado-client";
import { CATEGORIA_PROGRAMADO_ID } from "@/lib/intencion-compra/categoria-ic";
import { ProcesoImportacionWaitOverlay } from "@/components/report/ProcesoImportacionWaitOverlay";
import { PpFiCard } from "./PpFiCard";

type Props = {
  pp: PpDetalleHeader;
  ppId: string;
  facturas: PpFacturaInternaRow[];
  detallesPorFi: Record<number, FiDetalle[]>;
  vendedores: IcCatalogos["vendedores"];
  plazos: IcCatalogos["plazos"];
  onReload: () => void;
  onMsg: (text: string) => void;
};

export function PpTabFacturasInternas({ pp, ppId, facturas, detallesPorFi, vendedores, plazos, onReload, onMsg }: Props) {
  const editable = pp.listado_editable;
  const esProgramado = pp.categoria_id === CATEGORIA_PROGRAMADO_ID;
  const [csvVentasLoading, setCsvVentasLoading] = useState(false);
  const [csvInicialLoading, setCsvInicialLoading] = useState(false);
  const [fiBusy, setFiBusy] = useState(false);
  const [fiProgress, setFiProgress] = useState("");
  const [fiEstado, setFiEstado] = useState<{
    n_ic: number;
    n_fi: number;
    has_detalle_en_bd: boolean;
    needs_reimport_stock: boolean;
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
  const puedeCsv = esProgramado ? pp.n_facturas_internas > 0 : pp.n_fi_confirmadas > 0;

  const mostrarCrearFi =
    esProgramado && editable && pp.total_articulos > 0;

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
            has_detalle_en_bd: Boolean(d.has_detalle_en_bd ?? d.has_snapshot),
            needs_reimport_stock: Boolean(d.needs_reimport_stock),
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


  async function generarFiRiguroso() {
    const regenerar = pp.n_facturas_internas > 0;
    if (
      regenerar &&
      !window.confirm(
        "Se borran FI RESERVADA y se regeneran con paridad marca×caso (IC = PROFORMA = FI). ¿Continuar?",
      )
    ) {
      return;
    }
    setFiBusy(true);
    setFiProgress("Ratificando IC = PROFORMA = FI…");
    onMsg("");
    try {
      const data = await ejecutarRatificarFiProgramado(pp.id, regenerar);
      const avisoTxt =
        data.avisos && data.avisos.length > 0
          ? ` · ${data.avisos.length} avisos (ver consola diagnóstico)`
          : "";
      onMsg(`✓ ${resumenRatificarFi(data)}${avisoTxt}`);
      clearCachedCsv(pp.id);
      await onReload();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setFiBusy(false);
      setFiProgress("");
    }
  }

  async function descargarCsvVentas() {
    setCsvVentasLoading(true);
    try {
      clearCachedCsv(pp.id);
      const res = await fetch(
        `/api/proceso-importacion/pedido-proveedor/${pp.id}/csv-ventas?_=${Date.now()}`,
        { credentials: "same-origin", cache: "no-store" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error CSV");
      }
      const blob = await res.blob();
      triggerBlobDownload(blob, csvCarlosFilename(pp.numero_proforma, pp.numero_registro));
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Error CSV");
    } finally {
      setCsvVentasLoading(false);
    }
  }

  async function descargarCsvInicial() {
    setCsvInicialLoading(true);
    try {
      const res = await fetch(`/api/proceso-importacion/pedido-proveedor/${pp.id}/csv-inicial`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error CSV inicial");
      }
      const blob = await res.blob();
      triggerBlobDownload(blob, csvCarlosInicialFilename(pp.numero_proforma, pp.numero_registro));
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Error CSV inicial");
    } finally {
      setCsvInicialLoading(false);
    }
  }

  return (
    <section className="mt-4 space-y-4">
      <ProcesoImportacionWaitOverlay
        open={fiBusy}
        title="IC = PROFORMA = FI"
        detail={`${pp.numero_registro} · paridad marca×caso · sin mezclar`}
        hint={fiProgress || "No cierres la pestaña"}
      />
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-sm font-bold text-rimec-azul-dark">
            Ala Sur · Facturas internas ({facturasUnicas.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {puedeCsv && (
              <button
                type="button"
                disabled={csvVentasLoading}
                onClick={descargarCsvVentas}
                title="CSV ventas Carlos · FI programado"
                className="rounded-lg border border-emerald-400 bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-950 hover:bg-emerald-200 disabled:opacity-50"
              >
                {csvVentasLoading ? "Generando…" : "📄 CSV ventas"}
              </button>
            )}
            {pp.total_articulos > 0 && (
              <button
                type="button"
                disabled={csvInicialLoading}
                onClick={descargarCsvInicial}
                title="CSV cantidades iniciales · stock importado"
                className="rounded-lg border-2 border-cyan-400 bg-cyan-200 px-3 py-1.5 text-xs font-bold text-cyan-950 hover:bg-cyan-300 disabled:opacity-50"
              >
                {csvInicialLoading ? "Generando…" : "📋 CSV inicial"}
              </button>
            )}
          </div>
        </div>
        {pp.categoria_id === 3 && (
          <p className="mt-1 text-xs text-violet-900">
            PROGRAMADO · IC = PROFORMA = FI · 1 marca por FI · 1 caso por FI · CSV Carlos listo al ratificar.
          </p>
        )}
        {!editable && (
          <p className="mt-2 text-xs font-bold text-amber-800">PP ENVIADO — FI en solo lectura.</p>
        )}
      </div>

      {mostrarCrearFi && (
        <div className="rounded-xl border-2 border-violet-400 bg-violet-50 px-5 py-4">
          <p className="text-base font-extrabold text-violet-950">⚡ IC = PROFORMA = FI (riguroso)</p>
          <p className="mt-1 text-sm text-violet-900">
            Stock {pp.total_articulos} SKUs · {fiEstado?.n_ic ?? "—"} IC · pools por marca · caso único por FI · CSV
            veneno al terminar.
          </p>
          {pp.n_facturas_internas > 0 && (
            <p className="mt-2 text-xs font-semibold text-amber-900">
              Ya hay {pp.n_facturas_internas} FI — regenerar borra solo RESERVADA (no CONFIRMADA).
            </p>
          )}
          <button
            type="button"
            disabled={fiBusy}
            onClick={() => void generarFiRiguroso()}
            className="mt-4 rounded-xl bg-violet-700 px-6 py-3 text-sm font-extrabold text-white shadow hover:bg-violet-800 disabled:opacity-50"
          >
            {fiBusy
              ? "Generando…"
              : pp.n_facturas_internas > 0
                ? "Regenerar FI + CSV"
                : "Generar FI programadas"}
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
            vendedores={vendedores}
            plazos={plazos}
            detalles={detallesPorFi[fi.id] ?? []}
            onUpdated={onReload}
            onMsg={onMsg}
          />
        ))
      )}
    </section>
  );
}
