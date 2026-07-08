"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { EntidadActivoResumen, PanelControlResumen } from "@/lib/panel-control/queries-resumen";

const fmtN = (n: number) => new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(n);
const fmtGs = (n: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(n);

const ENTITY_STYLE: Record<
  EntidadActivoResumen["entidad"],
  { ring: string; badge: string; accent: string; saldo: string; btn: string }
> = {
  STOCK: {
    ring: "border-emerald-500/40",
    badge: "bg-emerald-600",
    accent: "text-emerald-800",
    saldo: "text-emerald-800",
    btn: "border-emerald-600/25 bg-emerald-50 text-emerald-800 hover:bg-emerald-600 hover:text-white",
  },
  COMPRA_PREVIA: {
    ring: "border-rimec-azul/40",
    badge: "bg-rimec-azul",
    accent: "text-rimec-azul",
    saldo: "text-rimec-azul",
    btn: "border-rimec-azul/25 bg-rimec-azul/5 text-rimec-azul hover:bg-rimec-azul hover:text-white",
  },
  PROGRAMADO: {
    ring: "border-amber-500/40",
    badge: "bg-amber-600",
    accent: "text-amber-900",
    saldo: "text-amber-900",
    btn: "border-amber-500/30 bg-amber-50 text-amber-900 hover:bg-amber-600 hover:text-white",
  },
};

function EntidadCard({ e }: { e: EntidadActivoResumen }) {
  const st = ENTITY_STYLE[e.entidad];

  const dualCp = e.entidad === "COMPRA_PREVIA";

  return (
    <section className={`rounded-2xl border-2 ${st.ring} bg-white shadow-sm`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white ${st.badge}`}>
              {e.entidad.replace("_", " ")}
            </span>
            <h3 className={`mt-2 font-serif text-lg font-semibold ${st.accent}`}>{e.label}</h3>
          </div>
          <span
            className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
              e.rimec_web ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-900"
            }`}
          >
            {e.rimec_web ? "RIMEC Web" : "Sin catálogo"}
          </span>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-neutral-ink-muted">Pares inicial</dt>
            <dd className="font-serif text-xl font-semibold text-neutral-ink">{fmtN(e.pares_inicial)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-neutral-ink-muted">Saldo</dt>
            <dd className={`font-serif text-xl font-semibold ${st.saldo}`}>{fmtN(e.pares_saldo)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-neutral-ink-muted">Vendido</dt>
            <dd className="font-medium text-rose-700">{fmtN(e.pares_vendidos)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-neutral-ink-muted">Moléculas</dt>
            <dd className="font-medium text-neutral-ink">{fmtN(e.moleculas)}</dd>
          </div>
          {e.monto_gs != null ? (
            <div className="col-span-2">
              <dt className="text-[10px] uppercase tracking-wider text-neutral-ink-muted">Monto Gs (PE)</dt>
              <dd className="font-serif text-lg font-semibold text-neutral-ink">{fmtGs(e.monto_gs)}</dd>
            </div>
          ) : null}
          {e.pedidos_abiertos > 0 ? (
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-neutral-ink-muted">Pedidos PP</dt>
              <dd className="font-medium text-neutral-ink">{fmtN(e.pedidos_abiertos)}</dd>
            </div>
          ) : null}
        </dl>

        {dualCp ? (
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Link
              href="/stock-transito/disponible"
              className="flex flex-col rounded-xl border border-rimec-azul/30 bg-rimec-azul/5 p-3 transition hover:border-rimec-azul hover:bg-rimec-azul/10"
            >
              <span className="text-[10px] font-bold uppercase tracking-wide text-rimec-azul">Saldo disponible</span>
              <span className="mt-1 font-serif text-lg font-semibold tabular-nums text-rimec-azul-dark">
                {fmtN(e.pares_saldo)} p
              </span>
              <span className="mt-2 text-[10px] font-semibold text-rimec-azul">Control stock →</span>
            </Link>
            <Link
              href="/stock-transito/ventas"
              className="flex flex-col rounded-xl border border-rose-200 bg-rose-50/80 p-3 transition hover:border-rose-400 hover:bg-rose-50"
            >
              <span className="text-[10px] font-bold uppercase tracking-wide text-rose-800">Ventas ejecutadas</span>
              <span className="mt-1 font-serif text-lg font-semibold tabular-nums text-rose-900">
                {fmtN(e.pares_vendidos)} p
              </span>
              <span className="mt-2 text-[10px] font-semibold text-rose-700">Detalle partidas →</span>
            </Link>
            <Link
              href={e.enlace_report}
              className="sm:col-span-2 text-center text-[10px] font-medium text-slate-500 hover:text-rimec-azul hover:underline"
            >
              Ver hub compra previa tránsito
            </Link>
          </div>
        ) : (
          <Link
            href={e.enlace_report}
            className={`mt-5 inline-flex w-full items-center justify-center rounded-xl border py-2 text-xs font-semibold uppercase tracking-widest transition ${st.btn}`}
          >
            Ver productos →
          </Link>
        )}
      </div>
    </section>
  );
}

export function MundoPanelControl() {
  const [data, setData] = useState<PanelControlResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/rimec/panel-control/resumen", { credentials: "include" });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "Error al cargar panel");
      setData(j as PanelControlResumen);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="p-8">
      <header className="mb-8 border-b border-rimec-azul/10 pb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rimec-azul">Alejandro Magno · v1</p>
        <h2 className="mt-1 font-serif text-3xl font-bold text-neutral-ink">Panel de Control</h2>
        <p className="mt-2 max-w-2xl text-sm text-neutral-ink-muted">
          Activos del holding por entidad comercial — STOCK · COMPRA PREVIA · PROGRAMADO. Sales Report sigue blindado
          como cabo al Excel.
        </p>
      </header>

      {loading ? (
        <p className="font-serif text-sm text-neutral-ink-muted">Cargando activos…</p>
      ) : err ? (
        <div className="rounded-xl border border-semantic-error/30 bg-semantic-error/10 p-4 text-sm text-semantic-error">
          {err}
          <button type="button" onClick={() => void load()} className="ml-3 underline">
            Reintentar
          </button>
        </div>
      ) : data ? (
        <>
          <p className="mb-6 text-xs text-neutral-ink-muted">{data.nota}</p>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {data.entidades.map((e) => (
              <EntidadCard key={e.entidad} e={e} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
