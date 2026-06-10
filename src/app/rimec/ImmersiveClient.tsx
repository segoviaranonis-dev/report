"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { getMockFullSnapshot } from "@/lib/rimec/build-full-snapshot";
import type { FullSnapshotResponse } from "@/lib/rimec/full-snapshot-types";
import { defaultSalesReportFilters, type SalesReportFilters } from "@/modules/sales-report/types";
import { MESES_LISTA, SALES_REPORT_WEB_VERSION } from "@/modules/sales-report/constants";
import { filtrosToFullSnapshotBody, isFullSnapshotApiPayload } from "@/lib/rimec/snapshot-to-pkg";

import { MundoDashboard } from "./components/MundoDashboard";
import { MundoClientes } from "./components/MundoClientes";
import { MundoMarcas } from "./components/MundoMarcas";
import { MundoVendedores } from "./components/MundoVendedores";
import { ImmersiveFiltersPanel } from "./components/ImmersiveFiltersPanel";

export type MundoId = "dashboard" | "clientes" | "marcas" | "vendedores";

type MetaApi = {
  configured: boolean;
  error?: string;
};

export function ImmersiveClient() {
  const [meta, setMeta] = useState<MetaApi | null>(null);
  const [filtros, setFiltros] = useState<SalesReportFilters>(() => defaultSalesReportFilters());
  const [snapshot, setSnapshot] = useState<FullSnapshotResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mundo, setMundo] = useState<MundoId>("dashboard");
  const [hasSyncedOnce, setHasSyncedOnce] = useState(false);
  const booted = useRef(false);

  const dataLive = meta?.configured === true;
  const metaReady = meta !== null;

  useEffect(() => {
    fetch("/api/rimec/meta")
      .then((r) => r.json())
      .then((j) => setMeta(j as MetaApi))
      .catch(() => setMeta(null));
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
      const j = await r.json();
      if (j.configured === false) {
        setSnapshot(null);
        return;
      }
      if (!r.ok) throw new Error(j.error ?? "Consulta error");
      if (!isFullSnapshotApiPayload(j as Record<string, unknown>)) throw new Error("Respuesta inválida");
      const snap = j as FullSnapshotResponse;
      setSnapshot({
        ...snap,
        jerarquia_clientes: Array.isArray(snap.jerarquia_clientes) ? snap.jerarquia_clientes : [],
      });
      setHasSyncedOnce(true);
    } catch (e) {
      setSnapshot(null);
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [filtros, dataLive]);

  useEffect(() => {
    if (!dataLive || booted.current) return;
    booted.current = true;
    void consultar();
  }, [dataLive, consultar]);

  const handleDemo = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      setSnapshot(getMockFullSnapshot(filtros));
      setHasSyncedOnce(true);
      setLoading(false);
      setErr(null);
    }, 500);
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
      const categoria_ids =
        c.categorias.length === 0
          ? f.categoria_ids
          : catFiltered.length > 0
            ? catFiltered
            : [c.categorias[0].id_categoria];

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

  const navItem = (id: MundoId, label: string) => (
    <button
      type="button"
      onClick={() => setMundo(id)}
      className={`px-6 py-3 font-serif tracking-widest uppercase text-sm transition-all duration-300 ${
        mundo === id
          ? "text-rimec-text-white border-b-2 border-rimec-text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
          : "text-white/60 hover:text-white hover:border-b-2 hover:border-white/30"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-white bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black overflow-x-hidden selection:bg-rimec-azul-light/30">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-white/10 bg-black/40 px-8 py-2 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-serif text-2xl font-light tracking-widest text-white hover:opacity-85 transition-opacity drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
            RIMEC
          </Link>
          <span className="rounded bg-rimec-text-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-rimec-azul">
            Sales Report v{SALES_REPORT_WEB_VERSION}
          </span>
        </div>
        <nav className="flex gap-2">
          {navItem("dashboard", "Dashboard")}
          {navItem("clientes", "Clientes")}
          {navItem("marcas", "Marcas")}
          {navItem("vendedores", "Vendedores")}
          <Link
            href="/ventas-fotos"
            className="px-6 py-3 font-serif text-sm uppercase tracking-widest text-white/60 transition-all hover:border-b-2 hover:border-rimec-text-white/60 hover:text-rimec-text-white"
          >
            Ventas + Fotos
          </Link>
        </nav>
      </header>

      <div className="flex h-[calc(100vh-70px)] gap-6 overflow-hidden p-6">
        <aside className="custom-scrollbar flex h-full w-[300px] shrink-0 flex-col gap-6 overflow-y-auto rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
          <div>
            <h3 className="mb-4 font-serif text-xs uppercase tracking-widest text-rimec-text-white">Parámetros</h3>
            <label className="text-xs uppercase tracking-wider text-white/50">Obj. Crecimiento (%)</label>
            <input
              type="range"
              min={0}
              max={200}
              value={filtros.objetivo_pct}
              onChange={(e) => setFiltros({ ...filtros, objetivo_pct: Number(e.target.value) })}
              className="mt-2 w-full accent-rimec-azul-light"
            />
            <div className="mt-1 text-right font-serif text-lg">{filtros.objetivo_pct}%</div>
          </div>

          <p className="text-[10px] leading-relaxed text-white/35">
            Tipo, mes y categoría siguen el dominio en cascada sobre{" "}
            <code className="rounded bg-black/40 px-1 text-white/50">v_ventas_pivot</code>; las{" "}
            <strong className="text-white/55">marcas</strong> se listan desde la tabla maestra{" "}
            <code className="rounded bg-black/40 px-1 text-white/50">marca_v2</code> acotada al pivot. Pulsá{" "}
            <strong className="text-white/60">Sincronizar</strong> para refrescar dominios y datos.
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
              disabled={loading || !dataLive}
              className="w-full rounded-xl border border-white/20 bg-white/10 py-3 text-xs uppercase tracking-widest text-white transition-all hover:bg-white/20 hover:shadow-[0_0_15px_rgba(255,255,255,0.2)] disabled:opacity-50"
            >
              {loading ? "Calculando..." : "Sincronizar"}
            </button>
            {!dataLive && metaReady && (
              <button
                type="button"
                onClick={handleDemo}
                className="mt-3 w-full rounded-xl border border-rimec-text-white/30 bg-rimec-azul-light/15 py-3 text-xs uppercase tracking-widest text-rimec-text-white shadow-[0_0_10px_rgba(0,43,78,0.2)] transition-all hover:bg-rimec-text-white hover:text-rimec-azul hover:shadow-[0_0_20px_rgba(255,255,255,0.35)]"
              >
                Modo demo (sin base)
              </button>
            )}
            {err ? <p className="mt-4 text-xs text-red-400">{err}</p> : null}
          </div>
        </aside>

        <main className="custom-scrollbar relative h-full flex-1 overflow-y-auto rounded-2xl">
          {!snapshot ? (
            <div className="flex h-full flex-col items-center justify-center px-8 text-center font-serif text-white/40">
              {loading ? (
                <>
                  <div className="animate-spin-slow mb-6 h-24 w-24 rounded-full border-2 border-dashed border-white/20" />
                  <p className="text-lg tracking-widest text-white/50">Calculando informe…</p>
                </>
              ) : (
                <>
                  <p className="max-w-md text-sm leading-relaxed text-white/45">
                    {!dataLive
                      ? "Sin base configurada en servidor: usá «Modo demo» en el panel para ver el informe completo con datos sintéticos."
                      : "Pulsá «Sincronizar» en el panel para cargar el snapshot desde la base."}
                  </p>
                </>
              )}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {mundo === "dashboard" && (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                >
                  <MundoDashboard data={snapshot} />
                </motion.div>
              )}
              {mundo === "clientes" && (
                <motion.div
                  key="clientes"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                >
                  <MundoClientes data={snapshot} />
                </motion.div>
              )}
              {mundo === "marcas" && (
                <motion.div
                  key="marcas"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                >
                  <MundoMarcas data={snapshot} />
                </motion.div>
              )}
              {mundo === "vendedores" && (
                <motion.div
                  key="vendedores"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                >
                  <MundoVendedores data={snapshot} />
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </main>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `,
        }}
      />
    </div>
  );
}
