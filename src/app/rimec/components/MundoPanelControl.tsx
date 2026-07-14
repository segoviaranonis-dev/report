"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { VENTA_VISUAL, ventaTileClass } from "@/lib/nexus/venta-visual";
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

function PeRamoBlock({
  ramo,
  accent,
}: {
  ramo: NonNullable<EntidadActivoResumen["ramos"]>["calzado"];
  accent: "emerald" | "violet";
}) {
  const border = accent === "emerald" ? "border-emerald-200 bg-emerald-50/60" : "border-violet-200 bg-violet-50/60";
  const title = accent === "emerald" ? "text-emerald-900" : "text-violet-900";
  const saldo = accent === "emerald" ? "text-emerald-800" : "text-violet-800";
  const icon = ramo.tipo_v2_id === 1 ? "👟" : "👕";

  return (
    <div className={`rounded-xl border p-3 ${border}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider ${title}`}>
        {icon} {ramo.label}
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div>
          <dt className="text-[9px] uppercase tracking-wider text-neutral-ink-muted">Inicial</dt>
          <dd className="font-serif font-semibold tabular-nums text-neutral-ink">{fmtN(ramo.pares_inicial)}</dd>
        </div>
        <div>
          <dt className="text-[9px] uppercase tracking-wider text-neutral-ink-muted">Saldo</dt>
          <dd className={`font-serif font-semibold tabular-nums ${saldo}`}>{fmtN(ramo.pares_saldo)}</dd>
        </div>
        <div>
          <dt className="text-[9px] uppercase tracking-wider text-neutral-ink-muted">Vendido</dt>
          <dd className={`font-medium tabular-nums ${VENTA_VISUAL.label}`}>{fmtN(ramo.pares_vendidos)}</dd>
        </div>
        <div>
          <dt className="text-[9px] uppercase tracking-wider text-neutral-ink-muted">Productos</dt>
          <dd className="font-medium tabular-nums text-neutral-ink">{fmtN(ramo.skus)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[9px] uppercase tracking-wider text-neutral-ink-muted">Monto Gs</dt>
          <dd className="font-serif text-sm font-semibold tabular-nums text-neutral-ink">{fmtGs(ramo.monto_gs)}</dd>
        </div>
      </dl>
    </div>
  );
}

function EntidadCard({ e }: { e: EntidadActivoResumen }) {
  const st = ENTITY_STYLE[e.entidad];

  const dualCp = e.entidad === "COMPRA_PREVIA";
  const dualProg = e.entidad === "PROGRAMADO";
  const peRamos = e.entidad === "STOCK" && e.ramos;

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

        {peRamos ? (
          <div className="mt-5 space-y-3">
            <PeRamoBlock ramo={peRamos.calzado} accent="emerald" />
            <PeRamoBlock ramo={peRamos.confecciones} accent="violet" />
          </div>
        ) : (
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
              <dd className={`font-medium ${VENTA_VISUAL.label}`}>{fmtN(e.pares_vendidos)}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-neutral-ink-muted">Productos</dt>
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
            {"pct_ejecucion" in e && e.pct_ejecucion != null ? (
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-neutral-ink-muted">Ejecución</dt>
                <dd className="font-medium text-neutral-ink">{e.pct_ejecucion.toFixed(1)}%</dd>
              </div>
            ) : null}
          </dl>
        )}

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
              <span className="mt-2 text-[10px] font-semibold text-rimec-azul">Operativa + Artículos →</span>
            </Link>
            <Link href="/stock-transito/ventas" className={ventaTileClass}>
              <span className={`text-[10px] font-bold uppercase tracking-wide ${VENTA_VISUAL.tileTitle}`}>
                Ventas ejecutadas
              </span>
              <span className={`mt-1 font-serif text-lg font-semibold tabular-nums ${VENTA_VISUAL.valueStrong}`}>
                {fmtN(e.pares_vendidos)} p
              </span>
              <span className={`mt-2 text-[10px] font-semibold ${VENTA_VISUAL.tileLink}`}>Detalle partidas →</span>
            </Link>
            <Link
              href={e.enlace_report}
              className="sm:col-span-2 text-center text-[10px] font-medium text-slate-500 hover:text-rimec-azul hover:underline"
            >
              Ver hub compra previa tránsito
            </Link>
          </div>
        ) : dualProg ? (
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Link href="/stock-programado" className={`flex flex-col rounded-xl border p-3 transition ${st.btn}`}>
              <span className="text-[10px] font-bold uppercase tracking-wide text-amber-900">Operativa</span>
              <span className="mt-1 font-serif text-lg font-semibold tabular-nums text-amber-950">
                {fmtN(e.pares_saldo)} p saldo
              </span>
              <span className="mt-2 text-[10px] font-semibold text-amber-800">Grilla + Artículos →</span>
            </Link>
            <Link href="/stock-programado?proforma=8051" className={ventaTileClass}>
              <span className={`text-[10px] font-bold uppercase tracking-wide ${VENTA_VISUAL.tileTitle}`}>
                Ventas ejecutadas
              </span>
              <span className={`mt-1 font-serif text-lg font-semibold tabular-nums ${VENTA_VISUAL.valueStrong}`}>
                {fmtN(e.pares_vendidos)} p
              </span>
              <span className={`mt-2 text-[10px] font-semibold ${VENTA_VISUAL.tileLink}`}>Proforma 8051 →</span>
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

  useEffect(() => {
    // HOTFIX EMAXCONN: prefetch desactivado — 3 APIs pesadas saturaban pool Supabase en prod.
    // if (data) prefetchGrillasPanelControl();
  }, [data]);

  return (
    <div className="p-8">
      <header className="mb-8 border-b border-rimec-azul/10 pb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rimec-azul">Alejandro Magno · v1</p>
        <h2 className="mt-1 font-serif text-3xl font-bold text-neutral-ink">Panel de Control</h2>
        <p className="mt-2 max-w-2xl text-sm text-neutral-ink-muted">
          Activos del holding por entidad comercial — STOCK · COMPRA PREVIA · PROGRAMADO. Sales Report sigue blindado
          como cabo al Excel.
        </p>
        <Link
          href="/herramienta-reposicion"
          className="mt-5 inline-flex items-center rounded-xl border-2 border-rimec-azul bg-rimec-azul px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-rimec-azul-dark"
        >
          Herramienta de reposición!!! →
        </Link>
        <p className="mt-1.5 text-[11px] text-neutral-500">
          Culminación AM · una grilla · PE + CP (disp/vend) + PROGRAMADO
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
