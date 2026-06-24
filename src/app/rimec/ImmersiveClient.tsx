"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { NexusHeaderZen } from "@/components/report/NexusHeaderZen";

export type MundoId = "dashboard" | "clientes" | "marcas" | "vendedores";

const MUNDO_IDS: MundoId[] = ["dashboard", "clientes", "marcas", "vendedores"];

function parseMundoParam(raw: string | null): MundoId | null {
  if (raw && MUNDO_IDS.includes(raw as MundoId)) return raw as MundoId;
  return null;
}

type MetaApi = {
  configured: boolean;
  error?: string;
};

export function ImmersiveClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [meta, setMeta] = useState<MetaApi | null>(null);
  const [filtros, setFiltros] = useState<SalesReportFilters>(() => defaultSalesReportFilters());
  const [snapshot, setSnapshot] = useState<FullSnapshotResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mundo, setMundo] = useState<MundoId>(() => parseMundoParam(searchParams.get("mundo")) ?? "dashboard");
  const [hasSyncedOnce, setHasSyncedOnce] = useState(false);
  const booted = useRef(false);

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
      onClick={() => selectMundo(id)}
      className={`rounded-full border px-5 py-2 font-serif text-xs font-semibold tracking-widest uppercase transition-all duration-300 ${
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
          {navItem("dashboard", "Dashboard")}
          {navItem("clientes", "Clientes")}
          {navItem("marcas", "Marcas")}
          {navItem("vendedores", "Vendedores")}
          <Link
            href="/ventas-fotos"
            className="rounded-full border border-rimec-azul/20 bg-white px-5 py-2 font-serif text-xs font-semibold uppercase tracking-widest text-rimec-azul transition-all hover:border-rimec-azul hover:bg-rimec-azul/5"
          >
            Ventas + Fotos
          </Link>
        </nav>
        </div>
      </section>

      <div className="flex h-[calc(100vh-92px)] gap-6 overflow-hidden p-6">
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
              disabled={loading || !dataLive}
              className="w-full rounded-xl border border-rimec-azul bg-rimec-azul py-3 text-xs uppercase tracking-widest text-rimec-text-white transition-all hover:bg-rimec-azul-light disabled:opacity-50"
            >
              {loading ? "Calculando..." : "Sincronizar"}
            </button>
            {!dataLive && metaReady && (
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

        <main className="custom-scrollbar relative h-full flex-1 overflow-y-auto rounded-2xl bg-white shadow-sm">
          {!snapshot ? (
            <div className="flex h-full flex-col items-center justify-center px-8 text-center font-serif text-neutral-ink-muted">
              {loading ? (
                <>
                  <div className="animate-spin-slow mb-6 h-24 w-24 rounded-full border-2 border-dashed border-rimec-azul/20" />
                  <p className="text-lg tracking-widest text-rimec-azul/70">Calculando informe…</p>
                </>
              ) : (
                <>
                  <p className="max-w-md text-sm leading-relaxed text-neutral-ink-muted">
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
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,43,78,0.08); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,43,78,0.18); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0,43,78,0.28); }
      `,
        }}
      />
    </div>
  );
}
