"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  VentaFotoRow,
  VentasFotosFilters,
  VentasFotosMarca,
  VentasFotosMetaResponse,
  VentasFotosPillarStats,
  VentasFotosResponse,
} from "@/lib/ventas-fotos/types";
import { recordReportPerf } from "@/lib/report/report-perf";
import {
  fetchReportApiWithRetry,
  isReportApiSaturated,
  reportApiErrorMessage,
} from "@/lib/rimec/fetch-api-retry";

const VentasFotosResults = dynamic(
  () => import("./VentasFotosResults").then((m) => ({ default: m.VentasFotosResults })),
  {
    ssr: false,
    loading: () => (
      <div className="mt-6 rounded-xl border border-report-rule bg-white p-8 text-center text-sm text-report-muted">
        Preparando panel de resultados…
      </div>
    ),
  },
);

const DEMO_MARCAS: VentasFotosMarca[] = [{ id_marca: 1, descp_marca: "Marca demo" }];

const DEMO_ROWS: VentaFotoRow[] = [
  {
    id_cliente: "5000",
    descp_cliente: "Cliente demostración",
    fecha: "2026-05-01",
    cantidad: 12,
    monto: 1200000,
    preventa: 1,
    tipo_venta: "VENTA",
    descp_marca: "Marca demo",
    imagen: "4076-1350-9569-15745.jpg",
    id_tipo: 1,
    desc_tipo: "CALZADOS",
    id_categoria: 1,
    descp_categoria: "Demo",
    linea_codigo: 4076,
    referencia_codigo: 1350,
    material_codigo: 9569,
    color_codigo: 15745,
    genero: "DAMAS",
    estilo: "TACO MEDIO",
    tipo_1: "CERRADO",
    material_nombre: "NAPA TURIM",
    color_nombre: "NEGRO 01",
    imagen_valid: true,
    imagen_error: null,
    image_url: "https://extrlcvcgypwazxipvqm.supabase.co/storage/v1/object/public/productos/4076-1350-9569-15745.jpg",
  },
];

const EMPTY_PILLAR_STATS: VentasFotosPillarStats = {
  resumen: { totalPares: 0, totalMonto: 0, articulosUnicos: 0, sinClasificar: 0 },
  porGenero: [],
  porEstilo: [],
  porTipo1: [],
  porColor: [],
  porCategoria: [],
};

function defaultDates() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 90);
  return {
    fechaInicio: start.toISOString().slice(0, 10),
    fechaFin: end.toISOString().slice(0, 10),
  };
}

async function readJsonResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const snippet = (await res.text()).slice(0, 100).replace(/\s+/g, " ");
    if (res.status === 504 || res.status === 503) {
      throw new Error("El servidor tardó demasiado (timeout). Probá de nuevo en unos segundos.");
    }
    throw new Error(`Error ${res.status} del servidor: ${snippet || "respuesta no JSON"}`);
  }
  return (await res.json()) as T;
}

async function readPdfResponse(res: Response): Promise<Blob> {
  const contentType = res.headers.get("content-type") ?? "";
  if (res.ok && contentType.includes("application/pdf")) {
    return res.blob();
  }
  const bodyText = await res.text();
  if (contentType.includes("application/json")) {
    try {
      const json = JSON.parse(bodyText) as { error?: string; message?: string };
      throw new Error(json.error ?? json.message ?? "Error al generar PDF");
    } catch (e) {
      if (e instanceof SyntaxError) {
        // respuesta mal formada
      } else if (e instanceof Error) {
        throw e;
      }
    }
  }
  const snippet = bodyText.slice(0, 100).replace(/\s+/g, " ");
  if (res.status === 504 || res.status === 503) {
    throw new Error("El PDF tardó demasiado en Vercel (timeout). Los datos del informe siguen válidos.");
  }
  throw new Error(`PDF no disponible (${res.status}): ${snippet || "respuesta inválida"}`);
}


function demoPillarStats(rows: VentaFotoRow[]): VentasFotosPillarStats {
  const totalPares = rows.reduce((s, r) => s + Math.abs(r.cantidad), 0);
  const totalMonto = rows.reduce((s, r) => s + Math.abs(r.monto), 0);
  const articulosUnicos = new Set(rows.map((r) => r.imagen).filter(Boolean)).size;
  const mk = (label: string, pares: number, monto: number) => ({
    label,
    pares,
    monto,
    pctPares: totalPares ? (pares / totalPares) * 100 : 0,
    pctMonto: totalMonto ? (monto / totalMonto) * 100 : 0,
  });
  return {
    resumen: { totalPares, totalMonto, articulosUnicos, sinClasificar: 0 },
    porGenero: rows[0]?.genero ? [mk(rows[0].genero, totalPares, totalMonto)] : [],
    porEstilo: rows[0]?.estilo ? [mk(rows[0].estilo, totalPares, totalMonto)] : [],
    porTipo1: rows[0]?.tipo_1 ? [mk(rows[0].tipo_1, totalPares, totalMonto)] : [],
    porColor: rows[0]?.color_nombre ? [mk(rows[0].color_nombre, totalPares, totalMonto)] : [],
    porCategoria: rows[0]?.descp_categoria ? [mk(rows[0].descp_categoria, totalPares, totalMonto)] : [],
  };
}

export function VentasFotosClient() {
  const dates = useMemo(defaultDates, []);
  const [meta, setMeta] = useState<VentasFotosMetaResponse | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [filters, setFilters] = useState<VentasFotosFilters>({
    clienteCodigo: "",
    fechaInicio: dates.fechaInicio,
    fechaFin: dates.fechaFin,
    marcaId: 0,
    referenciaPrefix: "",
  });
  const [data, setData] = useState<VentasFotosResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPDF, setLoadingPDF] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfState, setPdfState] = useState<"idle" | "generating" | "ready" | "error">("idle");
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const pdfRequestIdRef = useRef(0);
  const [pdfElapsedSeconds, setPdfElapsedSeconds] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const loadMeta = () => {
      fetchReportApiWithRetry("/api/ventas-fotos/meta", { cache: "no-store" })
        .then(async (r) => {
          const j = await readJsonResponse<VentasFotosMetaResponse & { code?: string }>(r);
          if (!r.ok) {
            if (isReportApiSaturated(j)) {
              throw new Error(reportApiErrorMessage(j, "Pool Supabase saturado"));
            }
            throw new Error(j.message ?? `Error HTTP ${r.status} leyendo marcas`);
          }
          return j;
        })
        .then((j) => {
          if (cancelled) return;
          setMeta(j);
          const firstMarca = j.marcas[0]?.id_marca ?? 0;
          if (firstMarca) setFilters((f) => ({ ...f, marcaId: firstMarca }));
        })
        .catch((err) => {
          if (cancelled) return;
          const msg = err instanceof Error ? err.message : "Error de red";
          const saturated = /saturad|EMAXCONN|max client/i.test(msg);
          if (saturated) {
            setMeta({ configured: true, marcas: [], message: msg });
          } else {
            setMeta({
              configured: false,
              marcas: DEMO_MARCAS,
              message: `${msg}; usando demostración.`,
            });
          }
        })
        .finally(() => {
          if (!cancelled) setMetaLoading(false);
        });
    };

    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(loadMeta, { timeout: 800 });
      return () => {
        cancelled = true;
        cancelIdleCallback(id);
      };
    }
    const t = window.setTimeout(loadMeta, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [pdfBlobUrl]);

  useEffect(() => {
    if (pdfState !== "generating") return;
    setPdfElapsedSeconds(0);
    const interval = setInterval(() => setPdfElapsedSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [pdfState]);

  const configured = meta?.configured === true;
  const marcas = meta?.marcas.length ? meta.marcas : DEMO_MARCAS;
  const rows = useMemo(() => data?.rows ?? (!configured ? DEMO_ROWS : []), [configured, data]);
  const pillarStats = data?.pillarStats ?? (!configured ? demoPillarStats(rows) : EMPTY_PILLAR_STATS);
  const cliente = data?.cliente ?? (rows[0] ? { id: rows[0].id_cliente, nombre: rows[0].descp_cliente } : null);
  const marca = data?.marca ?? marcas.find((m) => m.id_marca === filters.marcaId) ?? null;
  const referencias = useMemo(
    () => [...new Set(rows.map((r) => r.imagen).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [rows],
  );
  const userRequestedData = data !== null;

  async function cargar() {
    setLoading(true);
    setError(null);
    setPdfError(null);
    setPdfState("idle");
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
    try {
      const started = performance.now();
      const res = await fetchReportApiWithRetry("/api/ventas-fotos/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filters),
      });
      const json = await readJsonResponse<VentasFotosResponse & { code?: string }>(res);
      recordReportPerf(`ventas-fotos consulta`, performance.now() - started, "user");
      if (!res.ok) {
        throw new Error(reportApiErrorMessage(json, json.error ?? "Error al cargar ventas con fotos"));
      }
      setData(json);
      if (json.error) setError(json.error);
      if (json.rows && json.rows.length > 0) {
        generarPDFBackground();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar ventas con fotos");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function generarPDFBackground() {
    const currentRequestId = ++pdfRequestIdRef.current;
    setPdfState("generating");
    setPdfError(null);
    try {
      const res = await fetch("/api/ventas-fotos/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "filters", filters }),
      });
      if (currentRequestId !== pdfRequestIdRef.current) return;
      const blob = await readPdfResponse(res);
      setPdfBlobUrl(window.URL.createObjectURL(blob));
      setPdfState("ready");
    } catch (e) {
      if (currentRequestId === pdfRequestIdRef.current) {
        setPdfState("error");
        setPdfError(e instanceof Error ? e.message : "Error al generar PDF");
      }
    }
  }

  async function generarPDF() {
    if (!rows.length || !cliente || !marca) {
      setError("No hay datos para generar PDF");
      return;
    }
    if (pdfState === "ready" && pdfBlobUrl) {
      const a = document.createElement("a");
      a.href = pdfBlobUrl;
      a.download = `ventas-fotos-${cliente.id}-${marca.descp_marca.replace(/\s+/g, "_")}-${filters.fechaInicio}-${filters.fechaFin}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
    if (pdfState === "generating") return;
    setLoadingPDF(true);
    setPdfError(null);
    try {
      const res = await fetch("/api/ventas-fotos/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "filters", filters }),
      });
      const blob = await readPdfResponse(res);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ventas-fotos-${cliente.id}-${marca.descp_marca.replace(/\s+/g, "_")}-${filters.fechaInicio}-${filters.fechaFin}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : "Error al generar PDF");
      setPdfState("error");
    } finally {
      setLoadingPDF(false);
    }
  }

  return (
    <section className="border-b border-report-rule bg-report-paper text-report-ink print:border-0">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 print:max-w-none print:px-0">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-report-muted/70">
              Nuevo módulo · absorción info_ventas_fotos
            </p>
            <h1 className="mt-2 font-serif text-3xl font-bold text-report-navy">
              Informe de compras y tránsito con fotos
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-report-muted">
              Filtros listos al instante. La consulta a la base corre solo cuando pulsás{" "}
              <strong className="text-report-navy">Aplicar filtros</strong>.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={generarPDF}
              disabled={loadingPDF || !rows.length || pdfState === "generating" || !userRequestedData}
              className="rounded bg-report-navy px-4 py-2 text-xs font-semibold text-white hover:bg-report-navy2 disabled:opacity-40 disabled:cursor-not-allowed print:hidden"
            >
              {loadingPDF
                ? "Generando PDF..."
                : pdfState === "generating"
                  ? "Generando PDF..."
                  : pdfState === "ready"
                    ? "Descargar PDF"
                    : pdfState === "error"
                      ? "PDF no disponible, reintentar"
                      : "Generar PDF"}
            </button>
            {pdfState === "generating" ? (
              <div className="w-64">
                <div className="mb-1 flex items-center justify-between text-[10px] text-report-muted">
                  <span>Preparando PDF...</span>
                  <span>{pdfElapsedSeconds}s</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-report-rule">
                  <div
                    className="h-full bg-report-navy transition-all duration-500"
                    style={{
                      width: pdfElapsedSeconds < 10 ? `${(pdfElapsedSeconds / 10) * 100}%` : "100%",
                    }}
                  />
                </div>
              </div>
            ) : null}
            {pdfError ? <p className="max-w-xs text-right text-[10px] text-red-700">{pdfError}</p> : null}
          </div>
        </div>

        {!configured && !metaLoading ? (
          <p className="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 print:hidden">
            {meta?.message ?? "DATABASE_URL no configurada. Mostrando una maqueta funcional del módulo."}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        ) : null}

        <div className="mt-5 grid gap-3 rounded-xl border border-report-rule bg-white p-4 shadow-sm md:grid-cols-5 print:hidden">
          <Field label="Cliente">
            <input
              className="w-full rounded border border-report-rule px-2 py-1.5 text-sm"
              placeholder="Código cliente"
              value={filters.clienteCodigo}
              onChange={(e) => setFilters((f) => ({ ...f, clienteCodigo: e.target.value.replace(/\D/g, "") }))}
            />
          </Field>
          <Field label="Desde">
            <input
              className="w-full rounded border border-report-rule px-2 py-1.5 text-sm"
              type="date"
              value={filters.fechaInicio}
              onChange={(e) => setFilters((f) => ({ ...f, fechaInicio: e.target.value }))}
            />
          </Field>
          <Field label="Hasta">
            <input
              className="w-full rounded border border-report-rule px-2 py-1.5 text-sm"
              type="date"
              value={filters.fechaFin}
              onChange={(e) => setFilters((f) => ({ ...f, fechaFin: e.target.value }))}
            />
          </Field>
          <Field label="Marca">
            <select
              className="w-full rounded border border-report-rule px-2 py-1.5 text-sm"
              value={filters.marcaId || ""}
              disabled={metaLoading}
              onChange={(e) => setFilters((f) => ({ ...f, marcaId: Number(e.target.value) }))}
            >
              <option value="">{metaLoading ? "Cargando marcas…" : "Seleccionar"}</option>
              {marcas.map((m) => (
                <option key={m.id_marca} value={m.id_marca}>
                  {m.descp_marca}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Referencia / imagen">
            <input
              className="w-full rounded border border-report-rule px-2 py-1.5 text-sm"
              list="ventas-fotos-referencias"
              placeholder="Opcional"
              value={filters.referenciaPrefix ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, referenciaPrefix: e.target.value }))}
            />
            <datalist id="ventas-fotos-referencias">
              {referencias.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </Field>
          <div className="md:col-span-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={loading || metaLoading || !filters.clienteCodigo || !filters.marcaId}
              onClick={() => void cargar()}
              className="rounded bg-report-navy px-4 py-2 text-xs font-semibold text-white hover:bg-report-navy2 disabled:opacity-40"
            >
              {loading ? "Consultando…" : "Aplicar filtros"}
            </button>
            <span className="text-xs text-report-muted">
              Sin clic en Aplicar no se consulta la base · hasta 1.200 filas por informe.
            </span>
          </div>
        </div>

        {userRequestedData || (!configured && rows.length > 0) ? (
          <VentasFotosResults
            rows={rows}
            pillarStats={pillarStats}
            cliente={cliente}
            marca={marca}
            fechaInicio={filters.fechaInicio}
            fechaFin={filters.fechaFin}
          />
        ) : (
          <div className="mt-8 rounded-xl border border-dashed border-report-rule bg-white p-10 text-center text-sm text-report-muted">
            Completá cliente y marca, luego <strong className="text-report-navy">Aplicar filtros</strong> para cargar
            ventas, fotos y gráficos.
          </div>
        )}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-wide text-report-muted">
      {label}
      <span className="mt-1 block normal-case tracking-normal text-report-ink">{children}</span>
    </label>
  );
}
