"use client";

import { useCallback, useEffect, useState } from "react";
import {
  EMPTY_RETAIL_FILTERS,
  retailFiltersToQuery,
  type RetailFilterState,
} from "@/lib/retail/retail-filters";
import type { RetailFiltrosPayload } from "@/lib/retail/query-filtros";
import { STOCK_BOARD_DEMO_COLUMNAS } from "@/lib/retail/stock-board-demo";
import type { RetailBatchSummary, RetailMetaResponse, RetailStockBoardResponse } from "@/lib/retail/types";
import { RetailFiltrosHeader } from "./components/RetailFiltrosHeader";
import { RetailStockBoard } from "./components/RetailStockBoard";
import { RetailArbolSnapshot } from "./components/RetailArbolSnapshot";
import { RetailArbolTabla } from "./components/RetailArbolTabla";
import { exportarAnalisisPDF } from "@/lib/retail/pdf-export";
import { generarPDFRetail } from "@/lib/retail/pdfGeneratorRetail";
import { InformeVentasContent } from "./InformeVentasContent";

function fmtInt(n: number) {
  return new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(n);
}

type Props = {
  todayLabel: string;
};

type TabType = "catalogo" | "analisis" | "informe";

export function RetailStockClient({ todayLabel }: Props) {
  const [meta, setMeta] = useState<RetailMetaResponse | null>(null);
  const [batchId, setBatchId] = useState<string>("");
  const [filtros, setFiltros] = useState<RetailFilterState>(EMPTY_RETAIL_FILTERS);
  const [filtrosData, setFiltrosData] = useState<RetailFiltrosPayload | null>(null);
  const [data, setData] = useState<RetailStockBoardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [topN, setTopN] = useState(30);
  const [activeTab, setActiveTab] = useState<TabType>("catalogo");
  const [pdfProgress, setPdfProgress] = useState<{show: boolean; current: number; total: number}>({
    show: false,
    current: 0,
    total: 0
  });
  const [arbolData, setArbolData] = useState<{ configured: boolean; arbol: any[] } | null>(null);

  const configured = meta?.configured === true;
  const batches: RetailBatchSummary[] = meta?.batches ?? [];

  useEffect(() => {
    fetch("/api/retail/meta")
      .then((r) => r.json())
      .then((j: RetailMetaResponse) => {
        setMeta(j);
        if (j.batches[0]?.batchId) setBatchId(j.batches[0].batchId);
      })
      .catch(() => setMeta({ configured: false, batches: [] }));
  }, []);

  useEffect(() => {
    if (!configured || !batchId) return;
    fetch(`/api/retail/filtros?batch_id=${encodeURIComponent(batchId)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.configured) setFiltrosData(j as RetailFiltrosPayload);
      })
      .catch(() => setFiltrosData(null));
  }, [configured, batchId]);

  const cargar = useCallback(async () => {
    if (!configured) return;
    setLoading(true);
    setErr(null);
    try {
      const base = batchId
        ? `?batch_id=${encodeURIComponent(batchId)}&top=${topN}`
        : `?top=${topN}`;
      const r = await fetch(`/api/retail/stock-board${base}${retailFiltersToQuery(filtros)}`);
      const j = (await r.json()) as RetailStockBoardResponse;
      if (!r.ok) throw new Error(j.error ?? "Error al cargar stock retail");
      setData(j);
      if (j.error) setErr(j.error);
    } catch (e) {
      setData(null);
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [batchId, configured, filtros, topN]);

  useEffect(() => {
    if (!configured) return;
    void cargar();
  }, [configured, cargar]);

  useEffect(() => {
    if (!configured) return;
    const filtrosQuery = retailFiltersToQuery(filtros);
    fetch(`/api/retail/arbol-snapshot${filtrosQuery ? "?" + filtrosQuery.slice(1) : ""}`)
      .then((r) => r.json())
      .then((j) => setArbolData({ configured: j.configured, arbol: j.arbol || [] }))
      .catch(() => setArbolData(null));
  }, [configured, filtros]);

  const usandoDemo = !configured || (!data && !loading);
  const columnas = usandoDemo
    ? STOCK_BOARD_DEMO_COLUMNAS
    : (data?.columnas ?? []);
  const columnasOriginales = columnas;
  const kpis = data?.kpis;
  const filas = batches.find((b) => b.batchId === batchId)?.filas;

  return (
    <>
      {/* Barra de progreso PDF */}
      {pdfProgress.show && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
            <h3 className="text-lg font-semibold text-report-navy mb-4">Generando PDF...</h3>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-report-navy transition-all duration-300"
                style={{ width: `${(pdfProgress.current / pdfProgress.total) * 100}%` }}
              />
            </div>
            <p className="text-sm text-report-muted text-center">
              {pdfProgress.current} de {pdfProgress.total} tarjetas
            </p>
          </div>
        </div>
      )}

      <section className="border-b border-report-rule bg-report-paper text-report-ink">
        <div className="mx-auto max-w-6xl px-4 pb-2 pt-6 sm:px-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-report-muted/70">
            Segundo módulo · Informes
          </p>
          {configured && batches.length > 0 ? (
            <RetailBatchControls
              batches={batches}
              batchIdSelect={batchId}
              topN={topN}
              onTopChange={setTopN}
              onBatchChange={(id) => {
                setBatchId(id);
                setFiltros(EMPTY_RETAIL_FILTERS);
              }}
              onRefresh={cargar}
              loading={loading}
            />
          ) : null}
          {data?.pilares && !usandoDemo ? (
            <p
              className={`mt-2 text-xs ${data.pilares.filasPendientes > 0 ? "text-amber-700" : "text-emerald-700"}`}
            >
              Pilares (FK): {data.pilares.filasOk} OK · {data.pilares.filasPendientes} pendientes —{" "}
              {data.pilares.mensaje}
            </p>
          ) : null}
          {err ? <p className="mt-2 text-xs text-red-700">{err}</p> : null}
          {configured && data?.columnas.length === 0 ? (
            <p className="mt-2 text-xs text-amber-700">
              Sin referencias para estos filtros. Limpiar filtros.
            </p>
          ) : null}
          <p className="mt-2 text-[11px] text-report-muted/70">
            {usandoDemo
              ? `Demostración — ${todayLabel}. Fotos: bucket productos con nombre linea-ref-material_code-color_code (como RIMEC/Bazzar).`
              : `Lote: ${data?.batchLabel || batchId?.slice(0, 8) || "—"} · ${filas ?? "—"} filas · ${todayLabel}`}
          </p>
        </div>

        {configured && !usandoDemo ? (
          <RetailFiltrosHeader
            filtros={filtros}
            onChange={setFiltros}
            filtrosData={filtrosData}
            totalModelos={kpis?.referenciasActivas ?? 0}
            totalPares={kpis?.paresVentaTotal ?? 0}
            loading={loading}
          />
        ) : null}

        {/* Tabs UI */}
        {configured && !usandoDemo ? (
          <div className="border-t border-report-rule bg-report-paper2">
            <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("catalogo")}
                  className={`px-4 py-2 text-sm font-semibold transition-colors rounded-t ${
                    activeTab === "catalogo"
                      ? "bg-report-paper text-report-navy border-t-2 border-x border-report-navy"
                      : "bg-report-paper2 text-report-muted hover:text-report-ink"
                  }`}
                >
                  📸 Catálogo
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("analisis")}
                  className={`px-4 py-2 text-sm font-semibold transition-colors rounded-t ${
                    activeTab === "analisis"
                      ? "bg-report-paper text-report-navy border-t-2 border-x border-report-navy"
                      : "bg-report-paper2 text-report-muted hover:text-report-ink"
                  }`}
                >
                  📊 Análisis de Ventas
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("informe")}
                  className={`px-4 py-2 text-sm font-semibold transition-colors rounded-t ${
                    activeTab === "informe"
                      ? "bg-report-paper text-report-navy border-t-2 border-x border-report-navy"
                      : "bg-report-paper2 text-report-muted hover:text-report-ink"
                  }`}
                >
                  📄 Informe de Ventas
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Tab Content: Catálogo */}
        {activeTab === "catalogo" ? (
          <>
            <div className="border-b border-report-rule bg-report-paper px-6 py-3 flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  try {
                    setPdfProgress({ show: true, current: 0, total: columnasOriginales.length });

                    const pdfBytes = await generarPDFRetail(
                      {
                        batchLabel: data?.batchLabel || 'Retail',
                        columnas: columnasOriginales
                      },
                      (current, total) => {
                        setPdfProgress({ show: true, current, total });
                      }
                    );

                    // Descargar (convertir Buffer a Uint8Array para el navegador)
                    const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    const fecha = new Date().toISOString().split('T')[0];
                    a.download = `RIMEC_Stock_${(data?.batchLabel || 'Retail').replace(/\s+/g, '_')}_${fecha}.pdf`;
                    a.click();
                    URL.revokeObjectURL(url);

                    setPdfProgress({ show: false, current: 0, total: 0 });
                  } catch (e) {
                    setPdfProgress({ show: false, current: 0, total: 0 });
                    alert('Error: ' + (e instanceof Error ? e.message : 'Error generando PDF'));
                  }
                }}
                disabled={loading || columnasOriginales.length === 0 || pdfProgress.show}
                className="rounded bg-report-navy px-4 py-2 text-sm font-semibold text-white hover:bg-report-navy2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                📄 Generar PDF
              </button>
            </div>
            <div id="retail-stock-board">
              <RetailStockBoard columnas={columnas} />
            </div>
          </>
        ) : null}

        {/* Tab Content: Análisis */}
        {activeTab === "analisis" && kpis && configured && !usandoDemo ? (
          <>
            <KpiStrip arbol={arbolData?.arbol || null} />
            <div className="border-t border-report-rule bg-report-paper">
              <div className="mx-auto max-w-6xl px-6 py-8 space-y-12">
                <div>
                  <h2 className="mb-4 text-lg font-bold text-report-navy">
                    1. Resumen operativo (Ente → Género → Marca → SKU)
                  </h2>
                  <RetailArbolSnapshot filtros={filtros} />
                </div>

                <div className="pt-8 border-t border-report-rule">
                  <h2 className="mb-4 text-lg font-bold text-report-navy">
                    2. Análisis por Ente → Estilo → Marca → SKU
                  </h2>
                  <RetailArbolTabla
                    apiUrl="/api/retail/arbol-local-estilo-marca"
                    titulo="Tabla 1: Ente → Estilo → Marca → Artículo"
                    descripcionJerarquia="Ente → Estilo → Marca → SKU"
                    filtros={filtros}
                  />
                </div>

                <div className="pt-8 border-t border-report-rule">
                  <h2 className="mb-4 text-lg font-bold text-report-navy">
                    3. Análisis por Ente → Marca → Estilo → SKU
                  </h2>
                  <RetailArbolTabla
                    apiUrl="/api/retail/arbol-local-marca-estilo"
                    titulo="Tabla 2: Ente → Marca → Estilo → Artículo"
                    descripcionJerarquia="Ente → Marca → Estilo → SKU"
                    filtros={filtros}
                  />
                </div>
              </div>
            </div>
          </>
        ) : null}

        {/* Tab Content: Informe de Ventas */}
        {activeTab === "informe" && kpis && configured && !usandoDemo ? (
          <>
            <div className="border-b border-report-rule bg-report-paper px-6 py-3 flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await exportarAnalisisPDF(
                      kpis,
                      data?.batchLabel || batchId?.slice(0, 8) || 'Retail',
                    );
                  } catch (e) {
                    alert('Error al generar PDF: ' + (e instanceof Error ? e.message : 'Error desconocido'));
                  }
                }}
                className="rounded bg-report-navy px-4 py-2 text-sm font-semibold text-white hover:bg-report-navy2 transition-colors"
              >
                📄 Exportar PDF Informe
              </button>
            </div>
            <InformeVentasContent arbol={arbolData?.arbol || []} />
          </>
        ) : null}
      </section>
    </>
  );
}

function RetailBatchControls({
  batches,
  batchIdSelect,
  topN,
  onTopChange,
  onBatchChange,
  onRefresh,
  loading,
}: {
  batches: RetailBatchSummary[];
  batchIdSelect: string;
  topN: number;
  onTopChange: (n: number) => void;
  onBatchChange: (id: string) => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  const TOP_OPTIONS = [
    { label: "Top 30", value: 30 },
    { label: "+100", value: 100 },
    { label: "+500", value: 500 },
    { label: "+1000", value: 1000 },
  ] as const;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <label className="text-[11px] text-report-muted">
        Lote
        <select
          className="ml-2 rounded border border-report-rule bg-white px-2 py-1 text-xs text-report-ink"
          value={batchIdSelect}
          onChange={(e) => onBatchChange(e.target.value)}
        >
          {batches.map((b) => (
            <option key={b.batchId} value={b.batchId}>
              {b.batchLabel || b.archivoOrigen || b.batchId.slice(0, 8)} ({b.filas} filas)
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[11px] text-report-muted">Ranking:</span>
        {TOP_OPTIONS.map(({ label, value }) => (
          <button
            key={value}
            type="button"
            onClick={() => onTopChange(value)}
            disabled={loading}
            className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-40 ${
              topN === value
                ? "bg-report-navy text-white"
                : "border border-report-rule bg-white text-report-ink hover:bg-report-paper2"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onRefresh()}
        disabled={loading}
        className="rounded bg-report-navy px-3 py-1 text-xs text-white hover:bg-report-navy2 disabled:opacity-40 transition-colors font-sans"
      >
        {loading ? "Cargando…" : "Actualizar"}
      </button>
    </div>
  );
}

function KpiStrip({ arbol }: { arbol: any[] | null }) {
  // Filtrar solo tiendas (excluir RIMEC)
  const tiendas = (arbol || []).filter(n => n.nombre !== "RIMEC");

  return (
    <div className="border-b border-report-rule bg-report-paper2">
      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {tiendas.map((tienda) => (
            <div key={tienda.nombre} className="border border-report-rule bg-white px-4 py-3 shadow-sm">
              <p className="text-sm font-bold text-report-navy mb-2">{tienda.nombre}</p>
              <div className="space-y-1">
                <p className="text-xs text-report-muted">
                  Total Stock: <span className="font-semibold text-report-ink tabular-nums">{fmtInt(tienda.stock || 0)}</span>
                </p>
                <p className="text-xs text-report-muted">
                  Total Venta: <span className="font-semibold text-report-ink tabular-nums">{fmtInt(tienda.venta || 0)}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
