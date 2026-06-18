"use client";

import Link from "next/link";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import { BIBLIOTECA_CANONICA_LABEL } from "@/lib/motor-precios/constants";
import {
  MOTOR_BIBLIOTECA,
  MOTOR_BIBLIOTECA_NUEVA,
  PROCESO_IMPORTACION,
} from "@/lib/report/routes";

const CARDS = [
  {
    href: MOTOR_BIBLIOTECA_NUEVA,
    code: "2.3.1.7.1.2",
    title: "Crear biblioteca de precios",
    desc: "Alta de maestro biblioteca_precio · casos comerciales por proveedor.",
    icon: "➕",
  },
  {
    href: MOTOR_BIBLIOTECA,
    code: "2.3.1.7.1.1",
    title: "Biblioteca de precios",
    desc: `Histórico activo · referencia canónica ${BIBLIOTECA_CANONICA_LABEL}.`,
    icon: "📚",
  },
];

export function MotorPreciosHubClient() {
  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader active="proceso-importacion" />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">
          Proceso de importación · 2.3.1.7.1 · P.1.1
        </p>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">Motor de precios</h1>
        <p className="mt-3 max-w-2xl text-neutral-700">
          Corazón 1 — Biblioteca de casos. Paridad Streamlit · tabla <code className="text-sm">biblioteca_precio</code>.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {CARDS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group rounded-xl border-2 border-rimec-azul/20 bg-white p-6 shadow-sm transition hover:border-rimec-azul hover:shadow-md"
            >
              <div className="text-3xl">{c.icon}</div>
              <p className="mt-2 text-xs font-semibold text-rimec-azul/70">{c.code}</p>
              <h2 className="mt-1 font-serif text-xl font-semibold text-rimec-azul-dark group-hover:text-rimec-azul">
                {c.title}
              </h2>
              <p className="mt-2 text-sm text-neutral-600">{c.desc}</p>
            </Link>
          ))}
        </div>

        <Link
          href={PROCESO_IMPORTACION}
          className="mt-8 inline-block text-sm font-semibold text-rimec-azul hover:underline"
        >
          ← Proceso de importación
        </Link>
      </main>
      <ReportFooter note="Motor de precios · 2.3.1.7.1" />
    </div>
  );
}
