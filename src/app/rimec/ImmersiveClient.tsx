"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getMockFullSnapshot } from "@/lib/rimec/build-full-snapshot";
import type { FullSnapshotResponse } from "@/lib/rimec/full-snapshot-types";
import { defaultSalesReportFilters, type SalesReportFilters } from "@/modules/sales-report/types";
import {
  defaultCalzadosCategoriaIds,
  MESES_LISTA,
  SALES_REPORT_WEB_VERSION,
} from "@/modules/sales-report/constants";
import { filtrosToFullSnapshotBody, isFullSnapshotApiPayload } from "@/lib/rimec/snapshot-to-pkg";
import {
  markDashboardPaint,
  markRouteEnter,
  markSnapshotApplied,
  parseServerTiming,
  recordPrefetchSnapshotMs,
} from "@/lib/rimec/sales-report-perf";
import { recordReportPerf } from "@/lib/report/report-perf";
import {
  getSalesReportPrefetchState,
  prefetchSalesReportSnapshot,
  subscribeSalesReportPrefetch,
  type SalesReportMeta,
} from "@/lib/rimec/sales-report-prefetch";

import { MundoDashboard } from "./components/MundoDashboard";
import { MundoPanelControl } from "./components/MundoPanelControl";
import { ImmersiveFiltersPanel } from "./components/ImmersiveFiltersPanel";
import { RimecEntryShell } from "./components/RimecEntryShell";
import { NexusHeaderZen } from "@/components/report/NexusHeaderZen";

const MundoClientes = dynamic(
  () => import("./components/MundoClientes").then((m) => ({ default: m.MundoClientes })),
  { loading: () => null },
);
const MundoMarcas = dynamic(
  () => import("./components/MundoMarcas").then((m) => ({ default: m.MundoMarcas })),
  { loading: () => null },
);
const MundoVendedores = dynamic(
  () => import("./components/MundoVendedores").then((m) => ({ default: m.MundoVendedores })),
  { loading: () => null },
);

export type MundoId = "dashboard" | "panel-control" | "clientes" | "marcas" | "vendedores";

const MUNDO_IDS: MundoId[] = ["dashboard", "panel-control", "clientes", "marcas", "vendedores"];

const MUNDO_TRANSITION = { duration: 0.12, ease: "easeOut" as const };

/** Flash loader RIMEC — máximo 1 s al entrar o sincronizar (velocidad rayo). */
const RIMEC_ENTRY_SHELL_MAX_MS = 1000;

function parseMundoParam(raw: string | null): MundoId | null {
  if (raw && MUNDO_IDS.includes(raw as MundoId)) return raw as MundoId;
  return null;
}

type MetaApi = SalesReportMeta;

function normalizeSnapshot(j: Record<string, unknown>): FullSnapshotResponse {
  const snap = j as FullSnapshotResponse;
  return {
    ...snap,
    jerarquia_clientes: Array.isArray(snap.jerarquia_clientes) ? snap.jerarquia_clientes : [],
  };
}

export function ImmersiveClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPrefetch = getSalesReportPrefetchState();
  const [meta, setMeta] = useState<MetaApi | null>(() => initialPrefetch.meta);
  const [filtros, setFiltros] = useState<SalesReportFilters>(() => defaultSalesReportFilters());
  const [snapshot, setSnapshot] = useState<FullSnapshotResponse | null>(() => initialPrefetch.snapshot);
  const [bootLoading, setBootLoading] = useState(() => {
    if (initialPrefetch.snapshot) return false;
    return initialPrefetch.status === "idle" || initialPrefetch.status === "loading";
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(() => initialPrefetch.error);
  const [mundo, setMundo] = useState<MundoId>(() => parseMundoParam(searchParams.get("mundo")) ?? "dashboard");
  const [hasSyncedOnce, setHasSyncedOnce] = useState(() => initialPrefetch.snapshot !== null);
  const [entryShell, setEntryShell] = useState(true);
  const [syncShell, setSyncShell] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setEntryShell(false), RIMEC_ENTRY_SHELL_MAX_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const fromUrl = parseMundoParam(searchParams.get("mundo"));
    if (fromUrl) setMundo(fromUrl);
  }, [searchParams]);

  const selectMundo = useCallback(
    (id: MundoId) => {
      setMundo(id);
      const params = new URLSearchParams(searchParams.toString());
      params.set("mundo", id);
      router.replace(`/rimec?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const dataLive = meta?.configured === true;
  const metaReady = meta !== null;
  const showEntryShell = entryShell || syncShell;

  useEffect(() => {
    markRouteEnter();
  }, []);

  useEffect(() => {
    if (!snapshot || showEntryShell) return;
    markSnapshotApplied();
    const id = requestAnimationFrame(() => markDashboardPaint());
    return () => cancelAnimationFrame(id);
  }, [snapshot, showEntryShell]);

  useEffect(() => {
    let cancelled = false;

    const applyPrefetch = () => {
      if (cancelled) return;
      const state = getSalesReportPrefetchState();
      if (state.meta) setMeta(state.meta);
      if (state.snapshot) {
        setSnapshot(state.snapshot);
        setHasSyncedOnce(true);
        markSnapshotApplied();
      }
      if (state.error) setErr(state.error);
      if (state.status === "ready" || state.status === "error") {
        setBootLoading(false);
      } else if (state.status === "loading") {
        setBootLoading(true);
      }
    };

    applyPrefetch();
    const unsubscribe = subscribeSalesReportPrefetch(applyPrefetch);
    void prefetchSalesReportSnapshot().then(applyPrefetch);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const consultar = useCallback(async () => {
    if (!dataLive || loading) return;
    setSyncShell(true);
    setLoading(true);
    setErr(null);
    const shellCap = window.setTimeout(() => setSyncShell(false), RIMEC_ENTRY_SHELL_MAX_MS);
    const snapStarted = performance.now();
    try {
      const r = await fetch("/api/rimec/full-snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filtrosToFullSnapshotBody(filtros)),
      });
      const j = (await r.json()) as Record<string, unknown>;
      recordPrefetchSnapshotMs(performance.now() - snapStarted, parseServerTiming(j));
      const st = parseServerTiming(j);
      if (st) {
        recordReportPerf(
          `full-snapshot: red ${((performance.now() - snapStarted) / 1000).toFixed(2)}s · BD ${(st.totalMs / 1000).toFixed(2)}s`,
          performance.now() - snapStarted,
          "api",
        );
      }
      if (j.configured === false) {
        setSnapshot(null);
        return;
      }
      if (!r.ok) throw new Error(String(j.error ?? "Consulta error"));
      if (!isFullSnapshotApiPayload(j)) throw new Error("Respuesta inválida");
      setSnapshot(normalizeSnapshot(j));
      setHasSyncedOnce(true);
    } catch (e) {
      setSnapshot(null);
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      window.clearTimeout(shellCap);
      setSyncShell(false);
      setLoading(false);
    }
  }, [filtros, dataLive, loading]);

  const handleDemo = useCallback(() => {
    setBootLoading(false);
    setLoading(true);
    setTimeout(() => {
      setSnapshot(getMockFullSnapshot(filtros));
      setHasSyncedOnce(true);
      setLoading(false);
      setErr(null);
    }, 400);
  }, [filtros]);

  /** Tras cada snapshot: encajar selección al dominio devuelto (cascada tipo Streamlit). */
  useEffect(() => {
    if (!snapshot?.cascada) return;
    const c = snapshot.cascada;
    setFiltros((f) => {
      const dep = f.departamento.trim().toUpperCase();
      const depOk = c.departamentos.some((x) => x.trim().toUpperCase() === dep);
      const departamento = depOk ? f.departamento : (c.departamentos[0] ?? f.departamento);

      const catSet = new Set(c.categorias.map((x) => x.id_categoria));
      const catFiltered = f.categoria_ids.filter((id) => catSet.has(id));
      const calzadosDefault = defaultCalzadosCategoriaIds(c.categorias);
      const categoria_ids =
        c.categorias.length === 0
          ? f.categoria_ids.length
            ? f.categoria_ids
            : calzadosDefault
          : catFiltered.length >= 2
            ? catFiltered
            : calzadosDefault;

      const monthPool = c.meses_nombres.length > 0 ? c.meses_nombres : MESES_LISTA;
      const mesFiltered = f.meses.filter((m) => monthPool.includes(m));
      const meses =
        mesFiltered.length > 0 ? mesFiltered : monthPool.slice(0, Math.min(6, monthPool.length));

      return {
        ...f,
        departamento,
        categoria_ids,
        meses: meses.length ? meses : f.meses,
        marcas: f.marcas.filter((x) => c.marcas.includes(x)),
        cadenas: f.cadenas.filter((x) => c.cadenas.includes(x)),
        vendedores: f.vendedores.filter((x) => c.vendedores.includes(x)),
      };
    });
  }, [snapshot]);

  const renderMundo = () => {
    switch (mundo) {
      case "dashboard":
        return <MundoDashboard data={snapshot!} />;
      case "panel-control":
        return <MundoPanelControl />;
      case "clientes":
        return <MundoClientes data={snapshot!} />;
      case "marcas":
        return <MundoMarcas data={snapshot!} />;
      case "vendedores":
        return <MundoVendedores data={snapshot!} />;
    }
  };

  const navItem = (id: MundoId, label: string, normalCase = false) => (
    <button
      type="button"
      onClick={() => selectMundo(id)}
      className={`rounded-full border px-5 py-2 font-serif text-xs font-semibold tracking-widest transition-all duration-150 ${
        normalCase ? "normal-case" : "uppercase"
      } ${
        mundo === id
          ? "border-rimec-azul bg-rimec-azul text-rimec-text-white shadow-sm"
          : "border-rimec-azul/20 bg-white text-rimec-azul hover:border-rimec-azul hover:bg-rimec-azul/5"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-app-bg font-sans text-neutral-ink selection:bg-rimec-azul/15">
      <NexusHeaderZen active="rimec" maxWidthClass="max-w-none" />

      <section className="border-b border-rimec-azul/15 bg-white px-6 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-serif text-2xl font-bold tracking-widest text-rimec-azul hover:text-rimec-azul-light">
              RIMEC
            </Link>
            <span className="rounded bg-rimec-azul px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-rimec-text-white">
              Sales Report v{SALES_REPORT_WEB_VERSION}
            </span>
          </div>
          <nav className="flex flex-wrap gap-2">
            {navItem("dashboard", "Inf. Vtas. General.", true)}
            {navItem("panel-control", "Panel de Control", true)}
            {navItem("clientes", "Clientes")}
            {navItem("marcas", "Marcas")}
            {navItem("vendedores", "Vendedores")}
            <Link
              href="/ventas-fotos"
              className="rounded-full border border-rimec-azul/20 bg-white px-5 py-2 font-serif text-xs font-semibold uppercase tracking-widest text-rimec-azul transition-all duration-150 hover:border-rimec-azul hover:bg-rimec-azul/5"
            >
              Ventas + Fotos
            </Link>
          </nav>
        </div>
      </section>

      <div className="flex h-[calc(100vh-92px)] gap-6 overflow-hidden p-6">
        {mundo !== "panel-control" ? (
        <aside className="custom-scrollbar flex h-full w-[300px] shrink-0 flex-col gap-6 overflow-y-auto rounded-2xl border border-rimec-azul/15 bg-white p-6 shadow-sm">
          <div>
            <h3 className="mb-4 font-serif text-xs uppercase tracking-widest text-rimec-azul">Parámetros</h3>
            <label className="text-xs uppercase tracking-wider text-neutral-ink-muted">Obj. Crecimiento (%)</label>
            <input
              type="range"
              min={0}
              max={200}
              value={filtros.objetivo_pct}
              onChange={(e) => setFiltros({ ...filtros, objetivo_pct: Number(e.target.value) })}
              className="mt-2 w-full accent-rimec-azul-light"
            />
            <div className="mt-1 text-right font-serif text-lg text-rimec-azul">{filtros.objetivo_pct}%</div>
          </div>

          <p className="text-[10px] leading-relaxed text-neutral-ink-muted">
            Tipo, mes y categoría siguen el dominio en cascada sobre{" "}
            <code className="rounded bg-app-bg px-1 text-rimec-azul">v_ventas_pivot</code>; las{" "}
            <strong className="text-rimec-azul">marcas</strong> se listan desde la tabla maestra{" "}
            <code className="rounded bg-app-bg px-1 text-rimec-azul">marca_v2</code> acotada al pivot. Pulsá{" "}
            <strong className="text-rimec-azul">Sincronizar</strong> para refrescar dominios y datos.
          </p>

          <ImmersiveFiltersPanel
            filtros={filtros}
            setFiltros={setFiltros}
            cascada={snapshot?.cascada ?? null}
            hasSyncedOnce={hasSyncedOnce}
          />

          <div className="mt-auto">
            <button
              type="button"
              onClick={() => void consultar()}
              disabled={loading || bootLoading || !dataLive}
              className="w-full rounded-xl border border-rimec-azul bg-rimec-azul py-3 text-xs uppercase tracking-widest text-rimec-text-white transition-all hover:bg-rimec-azul-light disabled:opacity-50"
            >
              {loading || bootLoading ? "Calculando..." : "Sincronizar"}
            </button>
            {!dataLive && metaReady && !bootLoading && (
              <button
                type="button"
                onClick={handleDemo}
                className="mt-3 w-full rounded-xl border border-rimec-azul/30 bg-rimec-azul/5 py-3 text-xs uppercase tracking-widest text-rimec-azul transition-all hover:bg-rimec-azul hover:text-rimec-text-white"
              >
                Modo demo (sin base)
              </button>
            )}
            {err ? <p className="mt-4 text-xs text-rimec-azul">{err}</p> : null}
          </div>
        </aside>
        ) : (
        <aside className="custom-scrollbar flex h-full w-[280px] shrink-0 flex-col gap-4 overflow-y-auto rounded-2xl border border-rimec-azul/15 bg-white p-6 shadow-sm">
          <h3 className="font-serif text-xs uppercase tracking-widest text-rimec-azul">Panel Director</h3>
          <p className="text-[11px] leading-relaxed text-neutral-ink-muted">
            Vista de activos holding — tres entidades en un entorno. No usa filtros del informe de ventas.
          </p>
          <ul className="space-y-2 text-[11px] text-neutral-ink">
            <li><strong className="text-emerald-800">STOCK</strong> — Pronta entrega</li>
            <li><strong className="text-rimec-azul">COMPRA PREVIA</strong> — Tránsito · Web</li>
            <li><strong className="text-amber-900">PROGRAMADO</strong> — sin Web</li>
          </ul>
          <p className="mt-auto text-[10px] text-neutral-ink-muted">Actualiza con el botón en el panel principal.</p>
        </aside>
        )}

        <main className="custom-scrollbar relative h-full flex-1 overflow-y-auto rounded-2xl bg-white shadow-sm">
          <AnimatePresence mode="wait" initial={false}>
            {showEntryShell ? (
              <motion.div
                key="entry-shell"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <RimecEntryShell
                  variant="main"
                  message={
                    syncShell
                      ? "Sincronizando informe ejecutivo…"
                      : "Preparando Sales Report…"
                  }
                />
              </motion.div>
            ) : !snapshot && mundo !== "panel-control" ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex h-full flex-col items-center justify-center px-8 text-center font-serif text-neutral-ink-muted"
              >
                <p className="max-w-md text-sm leading-relaxed text-neutral-ink-muted">
                  {!dataLive
                    ? "Sin base configurada en servidor: usá «Modo demo» en el panel para ver el informe completo con datos sintéticos."
                    : "Pulsá «Sincronizar» en el panel para cargar el snapshot desde la base."}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={mundo === "panel-control" ? "panel-control" : "dashboard"}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <AnimatePresence mode="sync" initial={false}>
                  <motion.div
                    key={mundo}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={MUNDO_TRANSITION}
                  >
                    {renderMundo()}
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,43,78,0.08); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,43,78,0.18); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0,43,78,0.28); }
      `,
        }}
      />
    </div>
  );
}
