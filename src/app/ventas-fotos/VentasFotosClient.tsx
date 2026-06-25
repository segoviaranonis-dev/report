"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  PillarBucket,
  VentaFotoRow,
  VentasFotosFilters,
  VentasFotosMarca,
  VentasFotosMetaResponse,
  VentasFotosPillarStats,
  VentasFotosResponse,
} from "@/lib/ventas-fotos/types";
import { chartColorAt, RIMEC_RECHARTS_TOOLTIP } from "@/app/rimec/chart-theme";
import { ProductThumbFrame } from "@/components/product/ProductThumbFrame";
import { getImagenCandidates } from "@/lib/ventas-fotos/parse-imagen";

const fmtInt = new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 });
const fmtPct = new Intl.NumberFormat("es-PY", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

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
  if (contentType.includes("application/json")) {
    const json = (await res.json()) as { error?: string; message?: string };
    throw new Error(json.error ?? json.message ?? "Error al generar PDF");
  }
  const snippet = (await res.text()).slice(0, 100).replace(/\s+/g, " ");
  if (res.status === 504 || res.status === 503) {
    throw new Error("El PDF tardó demasiado en Vercel (timeout). Los datos del informe siguen válidos.");
  }
  throw new Error(`PDF no disponible (${res.status}): ${snippet || "respuesta inválida"}`);
}

function emptyKpis(rows: VentaFotoRow[]) {
  return {
    total_cantidad: rows.reduce((s, r) => s + Math.abs(r.cantidad), 0),
    total_monto: rows.reduce((s, r) => s + Math.abs(r.monto), 0),
    total_ventas: rows.filter((r) => r.tipo_venta === "VENTA").reduce((s, r) => s + Math.abs(r.cantidad), 0),
    total_transito: rows.filter((r) => r.tipo_venta === "TRANSITO").reduce((s, r) => s + Math.abs(r.cantidad), 0),
    articulos_unicos: new Set(rows.map((r) => r.imagen).filter(Boolean)).size,
  };
}

function demoPillarStats(rows: VentaFotoRow[]): VentasFotosPillarStats {
  const totalPares = rows.reduce((s, r) => s + Math.abs(r.cantidad), 0);
  const totalMonto = rows.reduce((s, r) => s + Math.abs(r.monto), 0);
  const articulosUnicos = new Set(rows.map((r) => r.imagen).filter(Boolean)).size;
  const mk = (label: string, pares: number, monto: number): PillarBucket => ({
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

  // Estados para PDF en background
  const [pdfState, setPdfState] = useState<"idle" | "generating" | "ready" | "error">("idle");
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const pdfRequestIdRef = useRef(0);
  const [pdfElapsedSeconds, setPdfElapsedSeconds] = useState(0);

  useEffect(() => {
    fetch("/api/ventas-fotos/meta", { credentials: "same-origin", cache: "no-store" })
      .then(async (r) => {
        const contentType = r.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          throw new Error(`La API de marcas respondió ${r.status} sin JSON`);
        }
        const json = (await r.json()) as VentasFotosMetaResponse;
        if (!r.ok) {
          throw new Error(json.message ?? `Error HTTP ${r.status} leyendo marcas`);
        }
        return json;
      })
      .then((j: VentasFotosMetaResponse) => {
        setMeta(j);
        const firstMarca = j.marcas[0]?.id_marca ?? 0;
        if (firstMarca) setFilters((f) => ({ ...f, marcaId: firstMarca }));
      })
      .catch((error) =>
        setMeta({
          configured: false,
          marcas: DEMO_MARCAS,
          message: error instanceof Error ? `${error.message}; usando demostración.` : "No se pudo leer la metadata; usando demostración.",
        }),
      );
  }, []);

  // Cleanup blob URL cuando cambia o se desmonta
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [pdfBlobUrl]);

  // Trackear tiempo de generación de PDF
  useEffect(() => {
    if (pdfState === "generating") {
      setPdfElapsedSeconds(0);
      const interval = setInterval(() => {
        setPdfElapsedSeconds((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [pdfState]);

  const configured = meta?.configured === true;
  const marcas = meta?.marcas.length ? meta.marcas : DEMO_MARCAS;
  const rows = useMemo(() => data?.rows ?? (!configured ? DEMO_ROWS : []), [configured, data]);
  const kpis = data?.kpis ?? emptyKpis(rows);
  const pillarStats = data?.pillarStats ?? (!configured ? demoPillarStats(rows) : EMPTY_PILLAR_STATS);
  const cliente = data?.cliente ?? (rows[0] ? { id: rows[0].id_cliente, nombre: rows[0].descp_cliente } : null);
  const marca = data?.marca ?? marcas.find((m) => m.id_marca === filters.marcaId) ?? null;
  const referencias = useMemo(
    () => [...new Set(rows.map((r) => r.imagen).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  async function cargar() {
    setLoading(true);
    setError(null);
    setPdfError(null);
    // Invalidar PDF anterior
    setPdfState("idle");
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
    try {
      const res = await fetch("/api/ventas-fotos/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filters),
      });
      const json = await readJsonResponse<VentasFotosResponse>(res);
      if (!res.ok) throw new Error(json.error ?? "Error al cargar ventas con fotos");
      setData(json);
      if (json.error) setError(json.error);
      // Si carga exitosa con datos, generar PDF en background
      if (json.rows && json.rows.length > 0) {
        generarPDFBackground(json);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar ventas con fotos");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function generarPDFBackground(_dataSnapshot: VentasFotosResponse) {
    const currentRequestId = ++pdfRequestIdRef.current;
    setPdfState("generating");
    setPdfError(null);

    try {
      const res = await fetch("/api/ventas-fotos/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "filters", filters }),
      });

      if (currentRequestId !== pdfRequestIdRef.current) {
        return;
      }

      const blob = await readPdfResponse(res);
      const url = window.URL.createObjectURL(blob);
      setPdfBlobUrl(url);
      setPdfState("ready");
    } catch (e) {
      if (currentRequestId === pdfRequestIdRef.current) {
        setPdfState("error");
        setPdfError(e instanceof Error ? e.message : "Error al generar PDF");
        console.error("Error generando PDF en background:", e);
      }
    }
  }

  async function generarPDF() {
    if (!rows.length || !cliente || !marca) {
      setError("No hay datos para generar PDF");
      return;
    }

    // Si el PDF ya está listo, descargarlo inmediatamente
    if (pdfState === "ready" && pdfBlobUrl) {
      const a = document.createElement("a");
      a.href = pdfBlobUrl;
      a.download = `ventas-fotos-${cliente.id}-${marca.descp_marca.replace(/\s+/g, "_")}-${filters.fechaInicio}-${filters.fechaFin}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // Si está generando, no hacer nada (botón debe estar deshabilitado)
    if (pdfState === "generating") {
      return;
    }

    // Si está idle o error, generar manualmente
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
              Reemplaza la app PyQt/MySQL legacy: mismo filtro por cliente, fecha, marca y referencia; datos servidos por
              Report y fotos desde Storage.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={generarPDF}
              disabled={loadingPDF || !rows.length || pdfState === "generating"}
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
            {pdfState === "generating" && (
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
                      animation: pdfElapsedSeconds >= 10 ? "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" : "none",
                    }}
                  />
                </div>
                {pdfElapsedSeconds > 10 && (
                  <p className="mt-2 text-[10px] text-report-muted">
                    PDF sigue preparándose; podés seguir usando el informe.
                  </p>
                )}
              </div>
            )}
            {pdfError ? (
              <p className="max-w-xs text-right text-[10px] text-red-700">{pdfError}</p>
            ) : null}
          </div>
        </div>

        {!configured ? (
          <p className="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 print:hidden">
            {meta?.message ?? "DATABASE_URL no configurada. Mostrando una maqueta funcional del módulo."}
          </p>
        ) : null}
        {error ? <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}

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
              onChange={(e) => setFilters((f) => ({ ...f, marcaId: Number(e.target.value) }))}
            >
              <option value="">Seleccionar</option>
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
              disabled={loading || !filters.clienteCodigo || !filters.marcaId}
              onClick={cargar}
              className="rounded bg-report-navy px-4 py-2 text-xs font-semibold text-white hover:bg-report-navy2 disabled:opacity-40"
            >
              {loading ? "Cargando…" : "Aplicar filtros"}
            </button>
            <span className="text-xs text-report-muted">
              Se devuelven hasta 1.200 filas para mantener estable el despliegue serverless.
            </span>
          </div>
        </div>

        <HeaderSummary cliente={cliente} marca={marca} fechaInicio={filters.fechaInicio} fechaFin={filters.fechaFin} />
        <PillarStatsBlock stats={pillarStats} hasRows={rows.length > 0} />
        <VentasFotosTable rows={rows} />
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

function HeaderSummary({
  cliente,
  marca,
  fechaInicio,
  fechaFin,
}: {
  cliente: { id: string; nombre: string } | null;
  marca: VentasFotosMarca | null;
  fechaInicio: string;
  fechaFin: string;
}) {
  return (
    <div className="mt-6 grid gap-3 border border-report-rule bg-report-paper2 p-4 text-sm md:grid-cols-4">
      <p>
        <span className="font-semibold text-report-navy">Cliente:</span> {cliente ? `${cliente.id} · ${cliente.nombre}` : "—"}
      </p>
      <p>
        <span className="font-semibold text-report-navy">Marca:</span> {marca?.descp_marca ?? "—"}
      </p>
      <p>
        <span className="font-semibold text-report-navy">Desde:</span> {fechaInicio || "—"}
      </p>
      <p>
        <span className="font-semibold text-report-navy">Hasta:</span> {fechaFin || "—"}
      </p>
    </div>
  );
}

function PillarStatsBlock({ stats, hasRows }: { stats: VentasFotosPillarStats; hasRows: boolean }) {
  const fmtMoney = new Intl.NumberFormat("es-PY", { style: "currency", currency: "PYG", minimumFractionDigits: 0 });

  if (!hasRows) {
    return (
      <div className="mt-6 rounded-xl border border-report-rule bg-white p-8 text-center text-sm text-report-muted shadow-sm">
        Aplicá filtros para ver las estadísticas por pilares.
      </div>
    );
  }

  return (
    <section className="mt-6 rounded-xl border border-report-rule bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-report-rule pb-3">
        <h2 className="font-serif text-xl font-bold text-report-navy">Estadísticas por pilares</h2>
        <ResumenCompacto stats={stats.resumen} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ChartTablePane title="Género" buckets={stats.porGenero} chart="pie" />
        <ChartTablePane title="Categoría" buckets={stats.porCategoria} chart="bar" />
        <ChartTablePane title="Estilo" buckets={stats.porEstilo} chart="bar" />
        <ChartTablePane title="Tipo" buckets={stats.porTipo1} chart="bar" />
        <ChartTablePane title="Color" buckets={stats.porColor} chart="bar" topN={10} />
      </div>

      {stats.resumen.sinClasificar > 0 ? (
        <p className="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          {stats.resumen.sinClasificar} fila{stats.resumen.sinClasificar === 1 ? "" : "s"} sin metadata de pilares — se
          agruparon como “Sin clasificar”. La imagen no matcheó contra <code>linea / referencia / linea_referencia</code>.
        </p>
      ) : null}

      <p className="mt-3 text-[10px] uppercase tracking-wide text-report-muted">
        Total monto: <span className="font-semibold text-report-navy">{fmtMoney.format(stats.resumen.totalMonto)}</span>
      </p>
    </section>
  );
}

function ResumenCompacto({ stats }: { stats: VentasFotosPillarStats["resumen"] }) {
  const fmtMoney = new Intl.NumberFormat("es-PY", { style: "currency", currency: "PYG", minimumFractionDigits: 0 });
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
      <SummaryChip label="Pares" value={fmtInt.format(stats.totalPares)} />
      <SummaryChip label="Monto" value={fmtMoney.format(stats.totalMonto)} />
      <SummaryChip label="Artículos únicos" value={fmtInt.format(stats.articulosUnicos)} />
    </div>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-report-muted">{label}</span>
      <span className="font-semibold tabular-nums text-report-navy">{value}</span>
    </span>
  );
}

function ChartTablePane({
  title,
  buckets,
  chart,
  topN,
}: {
  title: string;
  buckets: PillarBucket[];
  chart: "pie" | "bar";
  topN?: number;
}) {
  const data = topN ? buckets.slice(0, topN) : buckets;

  if (!data.length) {
    return (
      <div className="rounded-lg border border-report-rule bg-report-paper2 p-4 text-xs text-report-muted">
        Sin datos para {title.toLowerCase()}.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-report-rule bg-report-paper2 p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-report-navy">{title}</h3>
        <span className="text-[10px] text-report-muted">{buckets.length} segmento{buckets.length === 1 ? "" : "s"}</span>
      </div>

      <div className="mt-3 h-44 w-full">
        {chart === "pie" ? <PillarPie data={data} /> : <PillarBars data={data} />}
      </div>

      <PillarTable rows={data} />
      {topN && buckets.length > topN ? (
        <p className="mt-2 text-[10px] text-report-muted">Mostrando top {topN} de {buckets.length}.</p>
      ) : null}
    </div>
  );
}

function PillarPie({ data }: { data: PillarBucket[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="pares"
          nameKey="label"
          cx="40%"
          cy="50%"
          outerRadius={64}
          innerRadius={28}
          paddingAngle={1}
          stroke="#ffffff"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={chartColorAt(i)} />
          ))}
        </Pie>
        <Tooltip
          {...RIMEC_RECHARTS_TOOLTIP}
          formatter={(value, _name, ctx) => {
            const n = Number(value ?? 0);
            const bucket = ctx?.payload as PillarBucket | undefined;
            return [
              `${fmtInt.format(n)} pares · ${fmtPct.format(bucket?.pctPares ?? 0)} %`,
              bucket?.label ?? "",
            ];
          }}
        />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function PillarBars({ data }: { data: PillarBucket[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
        <XAxis type="number" tick={{ fontSize: 10, fill: "#4a3f35" }} tickFormatter={(v) => fmtInt.format(v)} />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fontSize: 10, fill: "#002B4E" }}
          width={90}
          interval={0}
        />
        <Tooltip
          cursor={{ fill: "rgba(0,43,78,0.05)" }}
          {...RIMEC_RECHARTS_TOOLTIP}
          formatter={(value, _name, ctx) => {
            const n = Number(value ?? 0);
            const bucket = ctx?.payload as PillarBucket | undefined;
            return [
              `${fmtInt.format(n)} pares · ${fmtPct.format(bucket?.pctPares ?? 0)} %`,
              bucket?.label ?? "",
            ];
          }}
        />
        <Bar dataKey="pares" radius={[0, 3, 3, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={chartColorAt(i)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function PillarTable({ rows }: { rows: PillarBucket[] }) {
  const fmtMoney = new Intl.NumberFormat("es-PY", { style: "currency", currency: "PYG", minimumFractionDigits: 0 });
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-report-rule text-left text-[10px] uppercase tracking-wide text-report-muted">
            <th className="py-1.5 font-semibold">Segmento</th>
            <th className="py-1.5 text-right font-semibold">Pares</th>
            <th className="py-1.5 text-right font-semibold">Monto</th>
            <th className="py-1.5 text-right font-semibold">% Pares</th>
            <th className="py-1.5 text-right font-semibold">% Monto</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.label} className="border-b border-report-rule/40 last:border-0">
              <td className="py-1.5">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: chartColorAt(i) }} />
                  {r.label}
                </span>
              </td>
              <td className="py-1.5 text-right tabular-nums">{fmtInt.format(r.pares)}</td>
              <td className="py-1.5 text-right tabular-nums">{fmtMoney.format(r.monto)}</td>
              <td className="py-1.5 text-right tabular-nums">{fmtPct.format(r.pctPares)}%</td>
              <td className="py-1.5 text-right tabular-nums">{fmtPct.format(r.pctMonto)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VentasFotosTable({ rows }: { rows: VentaFotoRow[] }) {
  if (!rows.length) {
    return (
      <div className="mt-6 rounded border border-report-rule bg-white p-8 text-center text-sm text-report-muted">
        Sin filas para los filtros seleccionados.
      </div>
    );
  }

  const fmtMoney = new Intl.NumberFormat("es-PY", { style: "currency", currency: "PYG", minimumFractionDigits: 0 });

  return (
    <div className="mt-6 overflow-x-auto border border-report-rule bg-white shadow-sm">
      <table className="report-table min-w-[960px]">
        <thead>
          <tr>
            <th className="w-28">Imagen</th>
            <th>Fecha</th>
            <th>Referencia</th>
            <th>Categoría</th>
            <th className="text-right">Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const thumbCandidates = row.imagen_valid
              ? (() => {
                  const c = getImagenCandidates(row.imagen);
                  return c.length > 0 ? c : [row.image_url];
                })()
              : [];
            return (
            <tr key={`${row.imagen}-${row.fecha}-${idx}`}>
              <td>
                <div className="w-20 print:w-16">
                  {row.imagen_valid ? (
                    <ProductThumbFrame
                      alt={row.imagen}
                      candidates={thumbCandidates}
                      size={80}
                    />
                  ) : (
                    <div className="h-20 w-20 bg-slate-100 border border-slate-200 rounded flex items-center justify-center text-[10px] text-slate-400 text-center p-1">
                      {row.imagen_error || "Sin imagen"}
                    </div>
                  )}
                </div>
              </td>
              <td className="tabular-nums">{row.fecha}</td>
              <td className="font-mono text-xs">{row.imagen || "—"}</td>
              <td className="text-xs">{row.descp_categoria || "—"}</td>
              <td className="text-right tabular-nums">{fmtInt.format(row.cantidad)}</td>
            </tr>
          );
          })}
        </tbody>
      </table>
    </div>
  );
}
