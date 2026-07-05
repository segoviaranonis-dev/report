"use client";

import Link from "next/link";

const CARDS = [
  {
    href: "/deposito-rimec/proceso",
    title: "Stock del proceso",
    lead: "Saldo Pedido Proveedor · resultante del ciclo de compra.",
    badge: "PROCESO_PP",
    icon: "📦",
    border: "border-rimec-azul/30 hover:border-rimec-azul",
    bg: "hover:bg-rimec-celeste-bg/50",
  },
  {
    href: "/stock-pronta-entrega",
    title: "Stock Pronta Entrega",
    lead: "Import CSV sdrm → catálogo RIMEC Web · depósito legal S00_D1/DEP2/D3.",
    badge: "STOCK_PE · v_stock_rimec",
    icon: "📥",
    border: "border-emerald-300 hover:border-emerald-600",
    bg: "hover:bg-emerald-50/80",
  },
] as const;

export function DepositoRimecHubClient() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col justify-center px-4 py-12">
      <Link href="/" className="text-sm text-rimec-azul hover:underline">
        ← Inicio Report
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-semibold text-slate-900">Depósito RIMEC</h1>
      <p className="mt-2 text-sm text-slate-600">2.3.1.10 · Elegí el origen del stock.</p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className={`group flex min-h-[180px] flex-col rounded-2xl border-2 bg-white p-6 shadow-sm transition-all ${c.border} ${c.bg}`}
          >
            <span className="text-3xl">{c.icon}</span>
            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">{c.badge}</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900 group-hover:text-rimec-azul">{c.title}</h2>
            <p className="mt-2 flex-1 text-sm leading-snug text-slate-600">{c.lead}</p>
            <span className="mt-4 text-sm font-semibold text-rimec-azul">Entrar →</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
