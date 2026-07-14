"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import { ReposicionArticuloCard } from "@/components/herramienta-reposicion/ReposicionArticuloCard";
import type { ReposicionArticulo } from "@/lib/herramienta-reposicion/merge-reposicion";

type Kpis = {
  moleculas: number;
  peDisponible: number;
  cpDisponible: number;
  cpVendido: number;
  programado: number;
};

const EMPTY_KPI: Kpis = {
  moleculas: 0,
  peDisponible: 0,
  cpDisponible: 0,
  cpVendido: 0,
  programado: 0,
};

function fmt(n: number) {
  return Math.round(n).toLocaleString("es-PY");
}

export function HerramientaReposicionClient() {
  const [articulos, setArticulos] = useState<ReposicionArticulo[]>([]);
  const [kpis, setKpis] = useState<Kpis>(EMPTY_KPI);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [soloConStock, setSoloConStock] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/herramienta-reposicion", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Error al cargar");
      setArticulos(data.articulos ?? []);
      setKpis(data.kpis ?? EMPTY_KPI);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
      setArticulos([]);
      setKpis(EMPTY_KPI);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtrados = useMemo(() => {
    let list = articulos;
    if (soloConStock) {
      list = list.filter((a) => a.totales.peDisponible + a.totales.cpDisponible > 0);
    }
    const t = q.trim().toLowerCase();
    if (!t) return list;
    return list.filter(
      (a) =>
        a.marca.toLowerCase().includes(t) ||
        `${a.linea}.${a.referencia}`.toLowerCase().includes(t) ||
        a.material.toLowerCase().includes(t) ||
        a.color.toLowerCase().includes(t) ||
        (a.descp_color ?? "").toLowerCase().includes(t),
    );
  }, [articulos, q, soloConStock]);

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader active="home" />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Link href="/rimec?mundo=panel-control" className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Panel de Control Alejandro Magno
        </Link>
        <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-rimec-azul">
          Alejandro Magno · culminación · 2.3.1.20
        </p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-rimec-azul-dark sm:text-4xl">
          Herramienta de reposición!!!
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-neutral-700">
          Una grilla de artículos con sumas duras: Pronta entrega disponible · Compra previa
          (disponible + ejecutada) · PROGRAMADO. Sin desglose por cliente. STOCK&apos;s naranja ·
          VENTAS en acordeón.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { l: "Moléculas", v: kpis.moleculas, c: "text-rimec-azul-dark" },
            { l: "PE disponible", v: kpis.peDisponible, c: "text-emerald-800" },
            { l: "CP disponible", v: kpis.cpDisponible, c: "text-rimec-azul" },
            { l: "CP vendido", v: kpis.cpVendido, c: "text-emerald-700" },
            { l: "PROGRAMADO", v: kpis.programado, c: "text-amber-900" },
          ].map((k) => (
            <div key={k.l} className="rounded-xl border-2 border-neutral-200 bg-white px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase text-neutral-500">{k.l}</p>
              <p className={`font-serif text-2xl font-semibold tabular-nums ${k.c}`}>{fmt(k.v)}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-end gap-3">
          <label className="min-w-[220px] flex-1 text-xs font-semibold text-neutral-600">
            Buscar (marca · L.R · material · color)
            <input
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ej. 2358.100 · MOLEKINHA"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700">
            <input
              type="checkbox"
              checked={soloConStock}
              onChange={(e) => setSoloConStock(e.target.checked)}
            />
            Solo con stock disponible
          </label>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-rimec-azul bg-rimec-azul/5 px-4 py-2 text-xs font-bold text-rimec-azul-dark hover:bg-rimec-azul/10"
          >
            Actualizar
          </button>
        </div>

        {err && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</p>
        )}
        {loading ? (
          <p className="mt-10 font-serif text-neutral-600">Cargando reposición AM…</p>
        ) : (
          <>
            <p className="mt-6 text-xs text-neutral-500">
              Mostrando {filtrados.length.toLocaleString("es-PY")} / {articulos.length.toLocaleString("es-PY")}{" "}
              artículos
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtrados.map((a) => (
                <ReposicionArticuloCard key={a.key} articulo={a} />
              ))}
            </div>
            {!filtrados.length && (
              <p className="mt-8 text-neutral-600">No hay artículos con esos filtros.</p>
            )}
          </>
        )}
      </main>
      <ReportFooter note="Herramienta de reposición · Alejandro Magno · PE + CP + PROGRAMADO" />
    </div>
  );
}
