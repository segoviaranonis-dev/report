"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { StockTransitoResumen } from "@/lib/stock-transito/queries-resumen";
import { VENTA_VISUAL } from "@/lib/nexus/venta-visual";
import { CpEstadisticasTab } from "./CpEstadisticasTab";

const fmtN = (n: number) => new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number | null) => (n == null ? "—" : `${n.toFixed(1)}%`);

type Props = {
  resumen: StockTransitoResumen;
};

const CARDS = [
  {
    href: "/stock-transito/disponible",
    title: "Saldo disponible",
    lead: "Control de stock en tránsito · moléculas con pares disponibles para venta en catálogo RIMEC Web.",
    badge: "DISPONIBLE · saldo > 0",
    icon: "📦",
    border: "border-rimec-azul/35 hover:border-rimec-azul",
    bg: "hover:bg-rimec-azul/5",
    kpiKey: "saldo" as const,
  },
  {
    href: "/stock-transito/ventas",
    title: "Ventas ejecutadas",
    lead: "Detalle de partidas vendidas · cantidad vendida por producto en pedidos proveedor compra previa.",
    badge: "VENTAS · pares_vendidos",
    icon: "📈",
    border: `${VENTA_VISUAL.hubBorder}`,
    bg: VENTA_VISUAL.hubBg,
    kpiKey: "vendido" as const,
  },
] as const;

type TabId = "operativa" | "estadisticas";

export function StockTransitoHubClient({ resumen }: Props) {
  const [tab, setTab] = useState<TabId>("operativa");
  const pct =
    resumen.pares_inicial > 0 ? (resumen.pares_vendidos / resumen.pares_inicial) * 100 : null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 pb-16">
      <Link href="/rimec?mundo=panel-control" className="text-sm text-rimec-azul hover:underline">
        ← Panel de Control
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-semibold text-slate-900">Compra previa · Tránsito</h1>
      <p className="mt-2 text-sm text-slate-600">
        {resumen.pedidos_pp} PP activos · {fmtN(resumen.moleculas)} productos · paridad :3001/estadisticas
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-center text-sm sm:grid-cols-4">
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Inicial</dt>
          <dd className="font-serif text-lg font-semibold tabular-nums text-slate-900">
            {fmtN(resumen.pares_inicial)}
          </dd>
        </div>
        <div>
          <dt className={`text-[10px] font-bold uppercase tracking-wide ${VENTA_VISUAL.label}`}>Vendido</dt>
          <dd className={`font-serif text-lg font-semibold tabular-nums ${VENTA_VISUAL.value}`}>
            {fmtN(resumen.pares_vendidos)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wide text-rimec-azul">Saldo</dt>
          <dd className="font-serif text-lg font-semibold tabular-nums text-rimec-azul">
            {fmtN(resumen.pares_saldo)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Ejecución</dt>
          <dd className="font-serif text-lg font-semibold tabular-nums text-slate-900">{fmtPct(pct)}</dd>
        </div>
      </dl>

      <div className="mt-8 flex gap-1 border-b border-slate-200">
        <TabBtn active={tab === "operativa"} onClick={() => setTab("operativa")}>
          Operativa
        </TabBtn>
        <TabBtn active={tab === "estadisticas"} onClick={() => setTab("estadisticas")}>
          Estadísticas y gráficos
        </TabBtn>
      </div>

      {tab === "operativa" ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {CARDS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className={`group flex min-h-[200px] flex-col rounded-2xl border-2 bg-white p-6 shadow-sm transition-all ${c.border} ${c.bg}`}
            >
              <span className="text-3xl">{c.icon}</span>
              <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">{c.badge}</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900 group-hover:text-rimec-azul">{c.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-snug text-slate-600">{c.lead}</p>
              <p className="mt-3 text-lg font-bold tabular-nums text-slate-800">
                {c.kpiKey === "saldo"
                  ? `${fmtN(resumen.pares_saldo)} p saldo`
                  : `${fmtN(resumen.pares_vendidos)} p vendidos`}
              </p>
              <span className="mt-3 text-sm font-semibold text-rimec-azul">Abrir grilla →</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-8">
          <CpEstadisticasTab
            resumenInicial={{
              pares_inicial: resumen.pares_inicial,
              pares_vendidos: resumen.pares_vendidos,
              pares_saldo: resumen.pares_saldo,
              pedidos_pp: resumen.pedidos_pp,
              moleculas: resumen.moleculas,
            }}
          />
        </div>
      )}
    </main>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-semibold transition ${
        active
          ? "border-b-2 border-rimec-azul text-rimec-azul"
          : "text-slate-500 hover:text-slate-800"
      }`}
    >
      {children}
    </button>
  );
}
