import Link from "next/link";
import { Suspense } from "react";
import { NexusHeaderZen } from "@/components/report/NexusHeaderZen";
import { ReportFooter } from "@/components/report/ReportFooter";

export const dynamic = "force-dynamic";

const CARDS = [
  {
    href: "/logistica-ok/proceso",
    title: "Logística de Proceso",
    lead: "Bandeja operativa Nexus · FI · semáforo · sync Pedido Proveedor.",
    badge: "PROCESO · logistica_pendiente",
    icon: "🚚",
    border: "border-rimec-azul/30 hover:border-rimec-azul",
    bg: "hover:bg-rimec-celeste-bg/50",
  },
  {
    href: "/logistica-ok/rimec",
    title: "Logística Rimec",
    lead: "Backlog TXT Carlos · informe ventas · cabeceras sin FI Nexus.",
    badge: "RIMEC · TXT_INFORME_VENTAS",
    icon: "📋",
    border: "border-violet-300 hover:border-violet-600",
    bg: "hover:bg-violet-50/80",
  },
] as const;

function LogisticaOkHub() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col justify-center px-4 py-12">
      <Link href="/" className="text-sm text-rimec-azul hover:underline">
        ← Inicio Report
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-semibold text-slate-900">Logística OK</h1>
      <p className="mt-2 text-sm text-slate-600">2.3.1.28 · Elegí el origen de la logística.</p>

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

export default function LogisticaOkPage() {
  return (
    <div className="min-h-screen bg-report-paper pb-16 text-report-ink">
      <NexusHeaderZen active="logistica-ok" maxWidthClass="max-w-3xl" />
      <Suspense fallback={<p className="px-4 py-8 text-sm text-slate-500">Cargando…</p>}>
        <LogisticaOkHub />
      </Suspense>
      <ReportFooter note="Logística OK · hub 2 tarjetas · 2.3.1.28" />
    </div>
  );
}
