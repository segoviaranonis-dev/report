"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  ALIAS_CURRENT_VALUE,
  ALIAS_TARGET_VALUE,
  ALIAS_VARIATION,
  MESES_LISTA,
} from "@/modules/sales-report/constants";
import { getMockAnalysisPackage, type RimecAnalysisPackage } from "@/lib/rimec/sales-logic";
import {
  filtrosToFullSnapshotBody,
  isFullSnapshotApiPayload,
  snapshotApiToPkgState,
} from "@/lib/rimec/snapshot-to-pkg";
import { defaultSalesReportFilters, type SalesReportFilters } from "@/modules/sales-report/types";
import {
  evolucionPorSemestre,
  fmtGs,
  mesesSemestre,
  pickSubdimKey,
  subrowsByCliente,
  type PivotRow,
} from "./rimec-view-utils";

const fmtPct = (n: number | null) =>
  n === null || Number.isNaN(n)
    ? "—"
    : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n)} %`;

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? fmtGs(v) : String(v);
  return String(v);
}

type MetaApi = {
  configured: boolean;
  categorias: { id_categoria: number; nombre: string }[];
  tipos: string[];
  /** Opciones para filtros multi-selección (misma vista que el pivot del informe). */
  marcasCatalogo?: string[];
  cadenasCatalogo?: string[];
  vendedoresCatalogo?: string[];
  error?: string;
};

type PkgState = RimecAnalysisPackage & {
  _debug?: { sql?: string; paramCount?: number; rows?: number; pivot_rows?: number };
};

/** Navegación por secciones (reemplazo de pestañas) — inspiración tipo dashboard fintech / campañas. */
const SECTION_NAV: { id: string; label: string }[] = [
  { id: "rim-t1", label: "Resumen" },
  { id: "rim-t2", label: "Crecimiento" },
  { id: "rim-t3", label: "Riesgo" },
  { id: "rim-t4", label: "Sin compra" },
  { id: "rim-cartera", label: "Cartera" },
  { id: "rim-t5", label: "Marcas" },
  { id: "rim-t6", label: "Matriz marcas" },
  { id: "rim-t7", label: "Vendedores" },
  { id: "rim-t8", label: "Detalle" },
];

type AmplifyState = { title: string; rows: PivotRow[]; priorityKeys?: string[] } | null;

function ActiveFiltersChips({ filters, meta }: { filters: SalesReportFilters; meta: MetaApi | null }) {
  const cats = filters.categoria_ids.map((id) => {
    const n = meta?.categorias?.find((c) => c.id_categoria === id)?.nombre;
    return n ?? `#${id}`;
  });
  return (
    <div className="flex flex-wrap gap-1.5 text-[10px] text-exec-muted">
      <span className="rounded-full border border-exec-line bg-exec-surface px-2.5 py-0.5 tabular-nums">
        Obj. {filters.objetivo_pct}%
      </span>
      <span className="rounded-full border border-exec-line bg-exec-surface px-2.5 py-0.5">{filters.departamento}</span>
      <span className="rounded-full border border-exec-line bg-exec-surface px-2.5 py-0.5">
        {filters.meses.length} meses
      </span>
      {cats.map((c) => (
        <span key={c} className="rounded-full border border-exec-line bg-exec-surface px-2.5 py-0.5">
          {c}
        </span>
      ))}
    </div>
  );
}

export function RimecClient() {
  const [meta, setMeta] = useState<MetaApi | null>(null);
  const [metaErr, setMetaErr] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<SalesReportFilters>(() => defaultSalesReportFilters());
  const [pkg, setPkg] = useState<PkgState | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [amplify, setAmplify] = useState<AmplifyState>(null);
  const [openSem, setOpenSem] = useState<Record<string, boolean>>({ s1: true, s2: true });

  const dataLive = meta?.configured === true;
  const metaReady = meta !== null;

  const tipoOpcionesClasico = useMemo(() => {
    const fromMeta = meta?.tipos?.filter((t) => String(t).trim()) ?? [];
    const base = fromMeta.length ? fromMeta : [filtros.departamento || "CALZADOS"];
    const out = ["TODOS", ...base.map((t) => String(t).trim().toUpperCase()).filter((t) => t !== "TODOS")];
    const cur = (filtros.departamento || "").trim().toUpperCase();
    if (cur && !out.includes(cur)) out.push(cur);
    return out;
  }, [meta?.tipos, filtros.departamento]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/rimec/meta");
        const j = (await r.json()) as MetaApi & { error?: string };
        if (!r.ok) {
          if (!cancelled) {
            setMetaErr(j.error ?? "Meta");
            setMeta(null);
          }
          return;
        }
        if (!cancelled) {
          setMetaErr(null);
          setMeta(j);
        }
      } catch {
        if (!cancelled) {
          setMetaErr("Sin conexión al servidor.");
          setMeta(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const consultar = useCallback(async () => {
    if (!dataLive) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/rimec/full-snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filtrosToFullSnapshotBody(filtros)),
      });
      const j = (await r.json()) as Record<string, unknown>;
      if (j.configured === false) {
        setPkg(null);
        return;
      }
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Consulta");
      if (!isFullSnapshotApiPayload(j)) throw new Error("Respuesta inválida (full-snapshot)");
      setPkg(snapshotApiToPkgState(j, filtros));
    } catch (e) {
      setPkg(null);
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [filtros, dataLive]);

  const handleDemo = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      setPkg(getMockAnalysisPackage(filtros));
      setLoading(false);
      setErr(null);
    }, 500);
  }, [filtros]);

  const setSem = (which: "s1" | "s2" | "year") => {
    setFiltros((f) => ({ ...f, meses: mesesSemestre(which) }));
  };

  const toggleMes = (m: string) => {
    setFiltros((f) => {
      const has = f.meses.includes(m);
      const meses = has ? f.meses.filter((x) => x !== m) : [...f.meses, m];
      return { ...f, meses: meses.length ? meses : [m] };
    });
  };

  const toggleCat = (id: number) => {
    setFiltros((f) => {
      const has = f.categoria_ids.includes(id);
      const categoria_ids = has ? f.categoria_ids.filter((x) => x !== id) : [...f.categoria_ids, id];
      return { ...f, categoria_ids: categoria_ids.length ? categoria_ids : [id] };
    });
  };

  const prioCliente = ["cliente", ALIAS_CURRENT_VALUE, ALIAS_TARGET_VALUE, ALIAS_VARIATION];
  const prioMarca = ["marca", ALIAS_CURRENT_VALUE, ALIAS_TARGET_VALUE, ALIAS_VARIATION];
  const prioVend = ["vendedor", ALIAS_CURRENT_VALUE, ALIAS_TARGET_VALUE, ALIAS_VARIATION];

  const crecTop = useMemo(
    () => (pkg ? pkg.cartera.crecimiento.slice(0, 25).map((r) => String(r.cliente ?? "")) : []),
    [pkg]
  );
  const subCrec = useMemo(() => {
    if (!pkg || !crecTop.length) return new Map<string, PivotRow[]>();
    return subrowsByCliente(pkg.pivot, crecTop, 12);
  }, [pkg, crecTop]);

  const riesTop = useMemo(
    () => (pkg ? pkg.cartera.riesgo.slice(0, 25).map((r) => String(r.cliente ?? "")) : []),
    [pkg]
  );
  const subRies = useMemo(() => {
    if (!pkg || !riesTop.length) return new Map<string, PivotRow[]>();
    return subrowsByCliente(pkg.pivot, riesTop, 12);
  }, [pkg, riesTop]);

  const scrollToId = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handlePdf = () => {
    window.print();
  };

  return (
    <div className="overflow-hidden rounded-sm border border-exec-line bg-exec-surface shadow-exec">
      <div className="flex flex-col lg:flex-row">
        <aside className="w-full shrink-0 border-b border-exec-line bg-exec-canvas p-6 lg:w-[min(100%,320px)] lg:border-b-0 lg:border-r lg:border-exec-line">
          <p className="font-serif text-lg font-light tracking-tight text-exec-ink">Parámetros</p>
          <p className="mt-1 text-[11px] font-normal leading-relaxed text-exec-muted">
            Consulta vía <span className="font-mono text-exec-ink/80">POST /api/rimec/full-snapshot</span> (JSON único
            precalculado). Ajustá el período y pulsá consultar.
          </p>
          {dataLive ? <ActiveFiltersChips filters={filtros} meta={meta} /> : null}

          <div className="mt-8 space-y-8 text-sm">
            <section>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-exec-subtle">
                Objetivo de crecimiento
              </h3>
              <label className="mt-3 block text-[11px] text-exec-muted">Incremento sobre base (%)</label>
              <input
                type="range"
                min={0}
                max={200}
                value={filtros.objetivo_pct}
                onChange={(e) => setFiltros((f) => ({ ...f, objetivo_pct: Number(e.target.value) }))}
                className="mt-2 h-1 w-full cursor-pointer appearance-none rounded-full bg-exec-line accent-exec-navy [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-exec-ink"
              />
              <p className="mt-2 text-center font-serif text-2xl font-light tabular-nums text-exec-ink">
                {filtros.objetivo_pct}%
              </p>
            </section>

            <section>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-exec-subtle">Período</h3>
              <div className="mt-3 flex gap-2">
                {(
                  [
                    ["s1", "1er sem."],
                    ["s2", "2do sem."],
                    ["year", "Año"],
                  ] as const
                ).map(([k, lab]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSem(k)}
                    className="flex-1 border border-exec-line bg-exec-surface py-2 text-[10px] font-medium uppercase tracking-wider text-exec-muted transition hover:border-exec-ink hover:text-exec-ink"
                  >
                    {lab}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-[10px] uppercase tracking-wider text-exec-subtle">Meses</p>
              <div className="mt-2 flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
                {MESES_LISTA.map((m) => (
                  <label
                    key={m}
                    className={`cursor-pointer border px-2 py-1 text-[10px] transition ${
                      filtros.meses.includes(m)
                        ? "border-exec-ink bg-exec-ink text-exec-surface"
                        : "border-transparent bg-exec-wash text-exec-muted hover:border-exec-line hover:text-exec-ink"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={filtros.meses.includes(m)}
                      onChange={() => toggleMes(m)}
                    />
                    {m}
                  </label>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-exec-subtle">Clasificación</h3>
              <label className="mt-3 block text-[11px] text-exec-muted">Departamento / tipo</label>
              <select
                className="mt-1.5 w-full border-b border-exec-line bg-transparent py-2 text-xs font-medium uppercase tracking-wide text-exec-ink outline-none transition focus:border-exec-navy"
                value={filtros.departamento.trim().toUpperCase()}
                onChange={(e) => setFiltros((f) => ({ ...f, departamento: e.target.value }))}
              >
                {tipoOpcionesClasico.map((t) => (
                  <option key={t} value={t}>
                    {t === "TODOS" ? "TODOS (Calzados + Confecciones)" : t}
                  </option>
                ))}
              </select>
              <p className="mt-5 text-[10px] uppercase tracking-wider text-exec-subtle">Categorías</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(meta?.categorias?.length ? meta.categorias : [{ id_categoria: 3, nombre: "Programado" }]).map(
                  (c) => (
                    <label
                      key={c.id_categoria}
                      className={`cursor-pointer border px-2.5 py-1 text-[10px] transition ${
                        filtros.categoria_ids.includes(c.id_categoria)
                          ? "border-exec-ink bg-exec-ink text-exec-surface"
                          : "border-exec-line bg-exec-surface text-exec-muted hover:border-exec-ink/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={filtros.categoria_ids.includes(c.id_categoria)}
                        onChange={() => toggleCat(c.id_categoria)}
                      />
                      {c.nombre}
                    </label>
                  )
                )}
              </div>
            </section>

            <section>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-exec-subtle">Entidades</h3>
              <EntityMultiSelect
                label="Marcas"
                options={meta?.marcasCatalogo ?? []}
                value={filtros.marcas}
                onChange={(marcas) => setFiltros((f) => ({ ...f, marcas }))}
                disabled={!dataLive}
                emptyMessage={
                  dataLive ? "Sin marcas en la vista." : "Conectá la base para listar marcas desde v_ventas_pivot."
                }
              />
              <EntityMultiSelect
                label="Cadenas"
                options={meta?.cadenasCatalogo ?? []}
                value={filtros.cadenas}
                onChange={(cadenas) => setFiltros((f) => ({ ...f, cadenas }))}
                disabled={!dataLive}
                emptyMessage={
                  dataLive ? "Sin cadenas en la vista." : "Conectá la base para listar cadenas desde v_ventas_pivot."
                }
              />
              <EntityMultiSelect
                label="Vendedores"
                options={meta?.vendedoresCatalogo ?? []}
                value={filtros.vendedores}
                onChange={(vendedores) => setFiltros((f) => ({ ...f, vendedores }))}
                disabled={!dataLive}
                emptyMessage={
                  dataLive
                    ? "Sin vendedores en la vista."
                    : "Conectá la base para listar vendedores desde v_ventas_pivot."
                }
              />
              <label className="mt-3 block text-[11px] text-exec-muted">Código cliente (exacto)</label>
              <input
                type="text"
                className="mt-1.5 w-full border-b border-exec-line bg-transparent py-2 font-mono text-[12px] text-exec-ink outline-none placeholder:text-exec-subtle focus:border-exec-navy"
                value={filtros.id_cliente_exacto ?? ""}
                onChange={(e) =>
                  setFiltros((f) => ({
                    ...f,
                    id_cliente_exacto: e.target.value.trim() ? e.target.value.trim() : null,
                  }))
                }
                placeholder="Opcional"
              />
            </section>

            <button
              type="button"
              disabled={loading || !dataLive}
              onClick={() => void consultar()}
              className="w-full bg-exec-ink py-3.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-exec-surface transition hover:bg-exec-navy disabled:opacity-35"
            >
              {loading ? "Consultando…" : "Consultar informe"}
            </button>
            {!dataLive && metaReady ? (
              <div className="mt-4 space-y-4 border-t border-exec-line pt-4">
                <p className="text-[10px] leading-relaxed text-exec-neg">
                  Falta <code className="font-mono text-exec-muted">DATABASE_URL</code> en el servidor (.env.local o Vercel).
                </p>
                <button
                  type="button"
                  onClick={handleDemo}
                  className="w-full border border-exec-pos bg-exec-pos/5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-exec-pos transition hover:bg-exec-pos hover:text-exec-surface"
                >
                  Usar datos de prueba (Demo)
                </button>
              </div>
            ) : null}
            {metaErr ? <p className="text-[10px] text-exec-neg">{metaErr}</p> : null}
          </div>
        </aside>

        <main
          id="rimec-print-root"
          className={`min-h-[520px] flex-1 p-6 lg:p-10 lg:pl-12 ${pkg ? "bg-gradient-to-br from-[#0a0e1a] via-[#0f1629] to-[#121c33] text-slate-200 print:bg-white print:text-exec-ink" : "bg-exec-surface"}`}
        >
          {err ? (
            <p className="border border-exec-neg/25 bg-exec-canvas px-4 py-3 text-sm text-exec-neg">{err}</p>
          ) : null}

          {!pkg ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center border border-dashed border-exec-line bg-exec-canvas/50 px-8 text-center">
              <p className="max-w-xs text-sm font-light leading-relaxed text-exec-muted">
                Configurá el período a la izquierda y pulsá{" "}
                <span className="font-medium text-exec-ink">Consultar informe</span> para ver el resumen ejecutivo,
                clientes, marcas y vendedores.
              </p>
            </div>
          ) : (
            <div
              className="space-y-10 print:space-y-4 [&_.border-exec-line]:border-white/10 [&_.border-exec-line-subtle]:border-white/5 [&_.text-exec-ink]:text-slate-100 [&_.text-exec-muted]:text-slate-400 [&_.text-exec-subtle]:text-slate-500 [&_.bg-exec-surface]:bg-white/[0.04] [&_.bg-exec-canvas]:bg-white/[0.06] [&_.bg-exec-canvas\\/60]:bg-white/[0.06] [&_.bg-exec-canvas\\/50]:bg-white/[0.04] [&_.bg-exec-canvas\\/40]:bg-white/[0.03] [&_.bg-exec-canvas\\/35]:bg-white/[0.03] [&_section]:shadow-[0_0_0_1px_rgba(255,255,255,0.06)] [&_section]:backdrop-blur-sm print:[&_section]:shadow-none"
            >
              <nav
                className="sticky top-0 z-20 -mx-6 mb-2 flex flex-wrap items-center gap-2 border-b border-white/10 bg-[#0a0e1a]/85 px-2 py-3 backdrop-blur-md lg:-mx-10 lg:px-0 print:hidden"
                aria-label="Secciones del informe"
              >
                {SECTION_NAV.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => scrollToId(id)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300 transition hover:border-indigo-400/40 hover:bg-indigo-500/20 hover:text-white"
                  >
                    {label}
                  </button>
                ))}
              </nav>

              <section id="rim-t1" className="scroll-mt-28">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-indigo-300/90 print:hidden">
                  Tabla 1 · Evolución semestral
                </p>
                <DashboardView
                  pkg={pkg}
                  filtros={filtros}
                  openSem={openSem}
                  setOpenSem={setOpenSem}
                  onAmplify={(t, rows, pk) => setAmplify({ title: t, rows, priorityKeys: pk })}
                  onPdf={handlePdf}
                />
              </section>

              <section id="rim-t2" className="scroll-mt-28">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-400/90 print:hidden">
                  Tabla 2 · Crecimiento
                </p>
                <ClienteBlock
                  title="Clientes en crecimiento"
                  rows={pkg.cartera.crecimiento}
                  priorityKeys={prioCliente}
                  hierarchical
                  subKey={pickSubdimKey(pkg.pivot)}
                  subMap={subCrec}
                  onAmplify={() => setAmplify({ title: "Clientes en crecimiento", rows: pkg.cartera.crecimiento, priorityKeys: prioCliente })}
                  onPdf={handlePdf}
                />
              </section>

              <section id="rim-t3" className="scroll-mt-28">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-400/90 print:hidden">
                  Tabla 3 · Riesgo
                </p>
                <ClienteBlock
                  title="Clientes en riesgo"
                  rows={pkg.cartera.riesgo}
                  priorityKeys={prioCliente}
                  hierarchical
                  subKey={pickSubdimKey(pkg.pivot)}
                  subMap={subRies}
                  onAmplify={() => setAmplify({ title: "Clientes en riesgo", rows: pkg.cartera.riesgo, priorityKeys: prioCliente })}
                  onPdf={handlePdf}
                />
              </section>

              <section id="rim-t4" className="scroll-mt-28">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400 print:hidden">
                  Tabla 4 · Sin compra
                </p>
                <ClienteBlock
                  title="Sin compra reciente"
                  rows={pkg.cartera.sinCompra}
                  priorityKeys={prioCliente}
                  onAmplify={() => setAmplify({ title: "Sin compra reciente", rows: pkg.cartera.sinCompra, priorityKeys: prioCliente })}
                  onPdf={handlePdf}
                />
              </section>

              <section id="rim-cartera" className="scroll-mt-28">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400 print:hidden">
                  Cartera completa
                </p>
                <ClienteBlock
                  title="Cartera completa"
                  rows={pkg.carteraCompleta}
                  priorityKeys={prioCliente}
                  onAmplify={() => setAmplify({ title: "Cartera completa", rows: pkg.carteraCompleta, priorityKeys: prioCliente })}
                  onPdf={handlePdf}
                />
              </section>

              <section id="rim-t5" className="scroll-mt-28">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-indigo-300/90 print:hidden">
                  Tabla 5 · Ranking marcas
                </p>
                <PanelTable
                  title="Ranking de marcas"
                  rows={pkg.porMarca}
                  priorityKeys={prioMarca}
                  onAmplify={() => setAmplify({ title: "Marcas", rows: pkg.porMarca, priorityKeys: prioMarca })}
                  onPdf={handlePdf}
                />
              </section>

              <section id="rim-t6" className="scroll-mt-28">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-indigo-300/90 print:hidden">
                  Tabla 6 · Matriz marcas (detalle)
                </p>
                <div className="mb-3 rounded-lg border border-indigo-400/20 bg-indigo-500/10 px-4 py-2 text-[11px] text-indigo-100/90 print:hidden">
                  La <strong className="text-slate-200">matriz Marca → Cadena → Cliente → Vendedor</strong> y el detalle jerárquico están en la{" "}
                  <strong className="text-slate-200">vista inmersiva</strong> (<code className="rounded bg-black/30 px-1">/rimec</code>, pestaña Marcas). Esta vista
                  clásica conserva el ranking agregado por marca (Tabla 5) como tabla ampliada para impresión y PDF.
                </div>
                <PanelTable
                  title="Matriz marcas — vista ampliada (ranking)"
                  rows={pkg.porMarca}
                  priorityKeys={prioMarca}
                  onAmplify={() => setAmplify({ title: "Matriz marcas", rows: pkg.porMarca, priorityKeys: prioMarca })}
                  onPdf={handlePdf}
                />
              </section>

              <section id="rim-t7" className="scroll-mt-28">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-indigo-300/90 print:hidden">
                  Tabla 7 · Ranking vendedores
                </p>
                <PanelTable
                  title="Ranking de vendedores"
                  rows={pkg.porVendedor}
                  priorityKeys={prioVend}
                  onAmplify={() =>
                    setAmplify({ title: "Vendedores", rows: pkg.porVendedor, priorityKeys: prioVend })
                  }
                  onPdf={handlePdf}
                />
              </section>

              <section id="rim-t8" className="scroll-mt-28">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-indigo-300/90 print:hidden">
                  Tabla 8 · Gestión detallada / operativo
                </p>
                <div className="mb-3 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-[11px] text-slate-400 print:hidden">
                  La <strong className="text-slate-200">jerarquía Vendedor → Cadena → Cliente → Marca → Mes</strong> está en la vista inmersiva (
                  <code className="rounded bg-black/30 px-1">/rimec</code>, pestaña Vendedores). Aquí se muestra el <strong className="text-slate-200">detalle pivot</strong>{" "}
                  plano (mismas filas que alimentan el snapshot) para auditoría y exportación clásica.
                </div>
                <PanelTable
                  title="Detalle operativo (pivot)"
                  rows={pkg.pivot}
                  priorityKeys={pkg.pivot.length ? Object.keys(pkg.pivot[0] as object) : []}
                  onAmplify={() =>
                    setAmplify({
                      title: "Detalle operativo",
                      rows: pkg.pivot,
                      priorityKeys: Object.keys(pkg.pivot[0] || {}),
                    })
                  }
                  onPdf={handlePdf}
                />
              </section>

              {pkg._debug ? (
                <details className="mt-6 text-[10px] text-slate-500 print:hidden">
                  <summary className="cursor-pointer uppercase tracking-wider">Depuración (desarrollo)</summary>
                  <pre className="mt-3 max-h-40 overflow-auto rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-slate-400">
                    {typeof pkg._debug.sql === "string"
                      ? pkg._debug.sql
                      : JSON.stringify(pkg._debug, null, 2)}
                  </pre>
                </details>
              ) : null}
            </div>
          )}
        </main>
      </div>

      {amplify ? (
        <AmplifyModal state={amplify} onClose={() => setAmplify(null)} />
      ) : null}
    </div>
  );
}

function EntityMultiSelect({
  label,
  options,
  value,
  onChange,
  disabled,
  emptyMessage,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  emptyMessage?: string;
}) {
  const toggle = (v: string) => {
    if (disabled) return;
    const has = value.includes(v);
    onChange(has ? value.filter((x) => x !== v) : [...value, v]);
  };

  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-exec-subtle">{label}</span>
        {options.length > 0 && !disabled ? (
          <div className="flex shrink-0 gap-2 text-[9px] text-exec-muted">
            <button
              type="button"
              className="underline-offset-2 hover:underline"
              onClick={() => onChange([...options])}
            >
              Todos
            </button>
            <button type="button" className="underline-offset-2 hover:underline" onClick={() => onChange([])}>
              Ninguno
            </button>
          </div>
        ) : null}
      </div>
      <div className="mt-1.5 max-h-36 overflow-y-auto rounded border border-exec-line bg-exec-canvas/30 px-2 py-1.5">
        {options.length === 0 ? (
          <p className="py-2 text-[10px] leading-snug text-exec-subtle">{emptyMessage ?? "Sin opciones"}</p>
        ) : (
          <ul className="space-y-0.5">
            {options.map((opt, i) => (
              <li key={`${opt}-${i}`}>
                <label
                  className={`flex cursor-pointer items-center gap-2 py-0.5 text-[11px] text-exec-ink ${
                    disabled ? "cursor-not-allowed opacity-40" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-3 w-3 shrink-0 rounded border-exec-line"
                    checked={value.includes(opt)}
                    onChange={() => toggle(opt)}
                    disabled={disabled}
                  />
                  <span className="min-w-0 truncate" title={opt}>
                    {opt}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DashboardView({
  pkg,
  filtros,
  openSem,
  setOpenSem,
  onAmplify,
  onPdf,
}: {
  pkg: PkgState;
  filtros: SalesReportFilters;
  openSem: Record<string, boolean>;
  setOpenSem: Dispatch<SetStateAction<Record<string, boolean>>>;
  onAmplify: (t: string, rows: PivotRow[], pk?: string[]) => void;
  onPdf: () => void;
}) {
  const at = pkg.kpis.atendimientoPct;
  const groups = evolucionPorSemestre(pkg.evolucionMes, filtros);
  const flatRows: PivotRow[] = groups.flatMap((g) =>
    g.rows.map((r) => ({
      mes: r.mes,
      [ALIAS_TARGET_VALUE]: r.montoObjetivo,
      [ALIAS_CURRENT_VALUE]: r.montoActual,
      [ALIAS_VARIATION]: r.variacionPct,
    }))
  );

  return (
    <div className="space-y-10">
      <div className="overflow-hidden rounded-2xl border border-exec-line bg-exec-line sm:grid sm:grid-cols-3">
        <KpiCard label="Clientes activos" value={String(pkg.kpis.totalClientes)} />
        <KpiCard
          label="Atendimiento"
          value={at === null ? "—" : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(at)}%`}
        />
        <KpiCard label="Variación global" value={fmtPct(pkg.kpis.variacionPct)} highlight />
      </div>

      <section className="rounded-2xl border border-exec-line bg-exec-surface">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-exec-line px-5 py-4">
          <h2 className="font-serif text-lg font-light tracking-tight text-exec-ink">Evolución mensual</h2>
          <div className="flex gap-2 print:hidden">
            <button
              type="button"
              onClick={() =>
                onAmplify("Evolución mensual", flatRows, [
                  "mes",
                  ALIAS_TARGET_VALUE,
                  ALIAS_CURRENT_VALUE,
                  ALIAS_VARIATION,
                ])
              }
              className="border border-exec-line bg-transparent px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-exec-ink transition hover:bg-exec-canvas"
            >
              Ampliar
            </button>
            <button
              type="button"
              onClick={onPdf}
              className="border border-exec-ink bg-exec-ink px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-exec-surface transition hover:bg-exec-navy"
            >
              PDF
            </button>
          </div>
        </div>
        <div className="overflow-x-auto px-1 pb-1">
          <table className="w-full min-w-[640px] border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-exec-line text-[10px] font-semibold uppercase tracking-[0.12em] text-exec-subtle">
                <th className="px-5 py-3 font-medium">Estructura</th>
                <th className="py-3 pl-0 font-medium">Mes</th>
                <th className="px-5 py-3 text-right font-medium">Monto obj.</th>
                <th className="px-5 py-3 text-right font-medium">Monto actual</th>
                <th className="px-5 py-3 text-right font-medium">Variación</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const open = openSem[g.key] ?? true;
                return (
                  <Fragment key={g.key}>
                    <tr
                      className="cursor-pointer border-b border-exec-line-subtle bg-exec-canvas/80 font-medium text-exec-ink"
                      onClick={() => setOpenSem((s) => ({ ...s, [g.key]: !open }))}
                    >
                      <td className="px-5 py-3" colSpan={2}>
                        <span className="mr-2 text-exec-subtle">{open ? "−" : "+"}</span>
                        {g.label}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-sm tabular-nums text-exec-ink">
                        {fmtGs(g.totObj)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-sm tabular-nums text-exec-ink">
                        {fmtGs(g.totAct)}
                      </td>
                      <td
                        className={`px-5 py-3 text-right font-mono text-sm tabular-nums ${(g.varPct ?? 0) >= 0 ? "text-exec-pos" : "text-exec-neg"}`}
                      >
                        {fmtPct(g.varPct)}
                      </td>
                    </tr>
                    {open
                      ? g.rows.map((r) => (
                          <tr
                            key={`${g.key}-${r.mes_idx}`}
                            className="border-b border-exec-line-subtle text-exec-muted transition hover:bg-exec-canvas/40"
                          >
                            <td className="px-5 py-2.5 pl-8 text-exec-subtle">·</td>
                            <td className="py-2.5 pr-5 text-exec-ink">{r.mes}</td>
                            <td className="px-5 py-2.5 text-right font-mono text-[12px] tabular-nums text-exec-muted">
                              {fmtGs(r.montoObjetivo)}
                            </td>
                            <td className="px-5 py-2.5 text-right font-mono text-[12px] tabular-nums text-exec-ink">
                              {fmtGs(r.montoActual)}
                            </td>
                            <td
                              className={`px-5 py-2.5 text-right font-mono text-[12px] tabular-nums ${
                                (r.variacionPct ?? 0) >= 0 ? "text-exec-pos" : "text-exec-neg"
                              }`}
                            >
                              {fmtPct(r.variacionPct)}
                            </td>
                          </tr>
                        ))
                      : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ClienteBlock({
  title,
  rows,
  priorityKeys,
  onAmplify,
  onPdf,
  hierarchical,
  subKey,
  subMap,
}: {
  title: string;
  rows: PivotRow[];
  priorityKeys: string[];
  onAmplify: () => void;
  onPdf: () => void;
  hierarchical?: boolean;
  subKey?: string | null;
  subMap?: Map<string, PivotRow[]>;
}) {
  return (
    <section className="rounded-2xl border border-exec-line bg-exec-surface">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-exec-line px-5 py-4">
        <h2 className="font-serif text-lg font-light tracking-tight text-exec-ink">{title}</h2>
        <div className="flex gap-2 print:hidden">
          <button
            type="button"
            onClick={onAmplify}
            className="border border-exec-line px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-exec-ink transition hover:bg-exec-canvas"
          >
            Ampliar
          </button>
          <button
            type="button"
            onClick={onPdf}
            className="border border-exec-ink bg-exec-ink px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-exec-surface transition hover:bg-exec-navy"
          >
            PDF
          </button>
        </div>
      </div>
      <div className="overflow-x-auto px-1 py-1">
        {hierarchical && subKey && subMap?.size ? (
          <HierarchyClientTable rows={rows} subKey={subKey} subMap={subMap} priorityKeys={priorityKeys} />
        ) : (
          <ExecutiveDataTable rows={rows} priorityKeys={priorityKeys} maxRows={80} />
        )}
      </div>
    </section>
  );
}

function HierarchyClientTable({
  rows,
  subKey,
  subMap,
  priorityKeys,
}: {
  rows: PivotRow[];
  subKey: string;
  subMap: Map<string, PivotRow[]>;
  priorityKeys: string[];
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const keys = priorityKeys.filter((k) => k !== "cliente");
  return (
    <table className="w-full min-w-[560px] border-collapse text-left text-[12px]">
      <thead>
        <tr className="border-b border-exec-line text-[10px] font-semibold uppercase tracking-[0.12em] text-exec-subtle">
          <th className="px-5 py-3 font-medium">Estructura</th>
          {keys.map((k) => (
            <th key={k} className="px-5 py-3 text-right font-medium">
              {k}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, 40).map((r) => {
          const name = String(r.cliente ?? "—");
          const o = open[name] ?? false;
          const subs = subMap.get(name) ?? [];
          return (
            <Fragment key={name}>
              <tr
                className="cursor-pointer border-b border-exec-line-subtle bg-exec-canvas/60 font-medium text-exec-ink"
                onClick={() => setOpen((s) => ({ ...s, [name]: !o }))}
              >
                <td className="px-5 py-3">
                  <span className="mr-2 text-exec-subtle">{o ? "−" : "+"}</span>
                  {name}
                  {subs.length ? (
                    <span className="ml-2 font-normal text-exec-subtle tabular-nums">({subs.length})</span>
                  ) : null}
                </td>
                {keys.map((k) => (
                  <td key={k} className="px-5 py-3 text-right font-mono text-sm tabular-nums text-exec-ink">
                    {formatCell(r[k])}
                  </td>
                ))}
              </tr>
              {o
                ? subs.map((sr, i) => (
                    <tr key={`${name}-${i}`} className="border-b border-exec-line-subtle text-exec-muted">
                      <td className="px-5 py-2 pl-10 text-[11px] text-exec-muted">
                        {String(sr[subKey] ?? "—").slice(0, 14)}
                        {String(sr[subKey] ?? "").length > 14 ? "…" : ""}
                      </td>
                      {keys.map((k) => (
                        <td key={k} className="px-5 py-2 text-right font-mono text-[11px] tabular-nums">
                          {formatCell(sr[k])}
                        </td>
                      ))}
                    </tr>
                  ))
                : null}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

function PanelTable({
  title,
  rows,
  priorityKeys,
  onAmplify,
  onPdf,
}: {
  title: string;
  rows: PivotRow[];
  priorityKeys: string[];
  onAmplify: () => void;
  onPdf: () => void;
}) {
  return (
    <section className="rounded-2xl border border-exec-line bg-exec-surface">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-exec-line px-5 py-4">
        <h2 className="font-serif text-lg font-light tracking-tight text-exec-ink">{title}</h2>
        <div className="flex gap-2 print:hidden">
          <button
            type="button"
            onClick={onAmplify}
            className="border border-exec-line px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-exec-ink transition hover:bg-exec-canvas"
          >
            Ampliar
          </button>
          <button
            type="button"
            onClick={onPdf}
            className="border border-exec-ink bg-exec-ink px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-exec-surface transition hover:bg-exec-navy"
          >
            PDF
          </button>
        </div>
      </div>
      <div className="overflow-x-auto px-1 py-1">
        <ExecutiveDataTable rows={rows} priorityKeys={priorityKeys} maxRows={120} />
      </div>
    </section>
  );
}

function ExecutiveDataTable({
  rows,
  maxRows,
  priorityKeys,
}: {
  rows: PivotRow[];
  maxRows: number;
  priorityKeys?: string[];
}) {
  if (!rows.length) return <p className="px-5 py-8 text-sm text-exec-muted">Sin datos en este corte.</p>;
  const slice = rows.slice(0, maxRows);
  const fromRow = Object.keys(slice[0] ?? {});
  const keys = priorityKeys?.length
    ? [...priorityKeys.filter((k) => fromRow.includes(k)), ...fromRow.filter((k) => !priorityKeys.includes(k))]
    : fromRow;
  return (
    <table className="w-full border-collapse text-left text-[12px]">
      <thead>
        <tr className="border-b border-exec-line text-[10px] font-semibold uppercase tracking-[0.12em] text-exec-subtle">
          {keys.map((k) => (
            <th
              key={k}
              className={`px-5 py-3 font-medium ${k.includes("Monto") || k.includes("Variación") ? "text-right" : ""}`}
            >
              {k}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {slice.map((row, i) => (
          <tr key={i} className="border-b border-exec-line-subtle transition hover:bg-exec-canvas/35">
            {keys.map((k) => {
              const isVar = k === ALIAS_VARIATION;
              const v = row[k];
              const n = typeof v === "number" ? v : Number(v);
              const pos = isVar && Number.isFinite(n) && n >= 0;
              const neg = isVar && Number.isFinite(n) && n < 0;
              return (
                <td
                  key={k}
                  className={`px-5 py-2.5 tabular-nums ${k.includes("Monto") || isVar ? "text-right font-mono text-sm" : "font-sans text-[12px]"} text-exec-ink ${pos ? "!text-exec-pos" : ""} ${neg ? "!text-exec-neg" : ""}`}
                >
                  {formatCell(v)}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function KpiCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`bg-exec-surface px-6 py-8 ${highlight ? "ring-1 ring-inset ring-exec-navy/15" : ""}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-exec-subtle">{label}</p>
      <p
        className={`mt-3 font-serif text-3xl font-light tabular-nums tracking-tight ${highlight ? "text-exec-pos" : "text-exec-ink"}`}
      >
        {value}
      </p>
    </div>
  );
}

function AmplifyModal({ state, onClose }: { state: NonNullable<AmplifyState>; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-exec-ink/40 p-4 backdrop-blur-[2px] print:hidden"
      role="dialog"
    >
      <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden border border-exec-line bg-exec-surface shadow-exec">
        <div className="flex items-center justify-between border-b border-exec-line px-6 py-4">
          <h3 className="font-serif text-lg font-light text-exec-ink">{state.title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center border border-exec-line text-exec-muted transition hover:border-exec-ink hover:text-exec-ink"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <div className="max-h-[calc(90vh-56px)] overflow-auto p-5">
          <ExecutiveDataTable rows={state.rows} maxRows={5000} priorityKeys={state.priorityKeys} />
        </div>
      </div>
    </div>
  );
}
