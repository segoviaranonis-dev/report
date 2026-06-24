"use client";

import Link from "next/link";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import {
  INTENCION_COMPRA_BANDEJA,
  INTENCION_COMPRA_NUEVA,
  PROCESO_IMPORTACION,
} from "@/lib/report/routes";

const CARDS = [
  {
    href: INTENCION_COMPRA_NUEVA,
    code: "2.3.1.7.3.1",
    title: "Intención",
    desc: "Registro · tipo + categoría → cabecera IC-YYYY-XXXX.",
    icon: "➕",
  },
  {
    href: INTENCION_COMPRA_BANDEJA,
    code: "2.3.1.7.3.2",
    title: "Bandeja IC",
    desc: "PENDIENTES editables · FECHA DE EMBARQUE · rastreo IC→PP.",
    icon: "📋",
    destacado: true,
  },
];

export function IntencionCompraHubClient() {
  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader active="proceso-importacion" />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link href={PROCESO_IMPORTACION} className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Ciclo de importación
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">
          2.3.1.7.3 · P.1.4
        </p>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">Intención de compra</h1>
        <p className="mt-3 max-w-2xl text-neutral-700">
          Módulo de <strong>registro</strong> de intenciones · cabecera financiera por marca.
        </p>
        <p className="mt-2 text-sm font-semibold text-amber-800">
          3.1 Registro · 3.2 Bandeja — solo cabecera, sin pilares ni proforma.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {CARDS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className={`group relative rounded-xl border-2 bg-white p-6 shadow-sm transition hover:shadow-md ${
                c.destacado
                  ? "border-rimec-azul/30 hover:border-rimec-azul"
                  : "border-amber-200 hover:border-rimec-azul/40"
              }`}
            >
              {c.destacado && (
                <span className="absolute right-3 top-3 rounded bg-rimec-azul/10 px-2 py-0.5 text-xs font-bold text-rimec-azul">
                  Operativo
                </span>
              )}
              <div className="text-3xl">{c.icon}</div>
              <p className="mt-2 text-xs font-semibold text-rimec-azul/70">{c.code}</p>
              <h2 className="mt-1 font-serif text-xl font-semibold text-rimec-azul-dark group-hover:text-rimec-azul">
                {c.title}
              </h2>
              <p className="mt-2 text-sm text-neutral-600">{c.desc}</p>
            </Link>
          ))}
        </div>
      </main>
      <ReportFooter note="Intención de compra · 2.3.1.7.3" />
    </div>
  );
}
