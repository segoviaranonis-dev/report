"use client";

import Link from "next/link";
import type { StockTransitoResumen } from "@/lib/stock-transito/queries-resumen";

const fmtN = (n: number) => new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(n);

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
    border: "border-rose-300 hover:border-rose-600",
    bg: "hover:bg-rose-50/80",
    kpiKey: "vendido" as const,
  },
] as const;

export function StockTransitoHubClient({ resumen }: Props) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 pb-16">
      <Link href="/rimec?mundo=panel-control" className="text-sm text-rimec-azul hover:underline">
        ← Panel de Control
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-semibold text-slate-900">
        Compra previa · Tránsito
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        {resumen.pedidos_pp} PP · {fmtN(resumen.moleculas)} productos · ejecución por partida
      </p>

      <dl className="mt-6 grid grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-center text-sm">
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Inicial</dt>
          <dd className="font-serif text-lg font-semibold tabular-nums text-slate-900">
            {fmtN(resumen.pares_inicial)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wide text-rose-700">Vendido</dt>
          <dd className="font-serif text-lg font-semibold tabular-nums text-rose-800">
            {fmtN(resumen.pares_vendidos)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wide text-rimec-azul">Saldo</dt>
          <dd className="font-serif text-lg font-semibold tabular-nums text-rimec-azul">
            {fmtN(resumen.pares_saldo)}
          </dd>
        </div>
      </dl>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
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
    </main>
  );
};
