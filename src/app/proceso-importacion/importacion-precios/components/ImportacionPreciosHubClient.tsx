"use client";

import Link from "next/link";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import {
  IMPORTACION_PRECIOS_NUEVO,
  PROCESO_IMPORTACION,
} from "@/lib/report/routes";

const SUBPANTALLAS = [
  {
    href: IMPORTACION_PRECIOS_NUEVO,
    code: "2.3.1.7.2.0",
    title: "Nuevo evento · Paso 0",
    desc: "Carga Excel proveedor · ley de género · crear precio_evento.",
    icon: "📥",
    estado: "transito" as const,
  },
  {
    href: "#",
    code: "2.3.1.7.2.1",
    title: "Historial de eventos",
    desc: "Listados cerrados y borradores por proveedor.",
    icon: "📋",
    estado: "proximo" as const,
  },
];

export function ImportacionPreciosHubClient() {
  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader active="proceso-importacion" />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link href={PROCESO_IMPORTACION} className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Proceso de importación
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">2.3.1.7.2 · P.1.2</p>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">Importación de precios</h1>
        <p className="mt-3 max-w-2xl text-neutral-700">
          Corazón 2 — <strong>Caso + Excel = evento</strong>. Paridad Streamlit «Nuevo Evento» (Pasos 0–5).
        </p>

        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>Etapa en tránsito.</strong> Paso 0 documentado (CHUSAR). API carga — siguiente sesión.
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {SUBPANTALLAS.map((s) =>
            s.estado === "transito" ? (
              <Link
                key={s.code}
                href={s.href}
                className="group relative rounded-xl border-2 border-rimec-azul/20 bg-white p-6 shadow-sm transition hover:border-rimec-azul hover:shadow-md"
              >
                <span className="absolute right-3 top-3 rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
                  Tránsito
                </span>
                <div className="text-3xl">{s.icon}</div>
                <p className="mt-2 text-xs font-semibold text-rimec-azul/70">{s.code}</p>
                <h2 className="mt-1 font-serif text-xl font-semibold text-rimec-azul-dark group-hover:text-rimec-azul">
                  {s.title}
                </h2>
                <p className="mt-2 text-sm text-neutral-600">{s.desc}</p>
              </Link>
            ) : (
              <div
                key={s.code}
                className="relative rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 opacity-80"
              >
                <span className="absolute right-3 top-3 rounded bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">
                  Próximo
                </span>
                <div className="text-3xl grayscale">{s.icon}</div>
                <p className="mt-2 text-xs font-semibold text-slate-500">{s.code}</p>
                <h2 className="mt-1 font-serif text-xl font-semibold text-slate-600">{s.title}</h2>
                <p className="mt-2 text-sm text-slate-500">{s.desc}</p>
              </div>
            ),
          )}
        </div>

        <ul className="mt-8 list-inside list-disc space-y-1 text-sm text-slate-700">
          <li>Paso 0 — Carga Excel + crear precio_evento</li>
          <li>Biblioteca — aplicar casos al listado</li>
          <li>Pasos 1–2 — Memoria + matriz casos / líneas</li>
          <li>Pasos 3–5 — Preview · validación · cierre</li>
        </ul>
      </main>
      <ReportFooter note="Importación de precios · 2.3.1.7.2" />
    </div>
  );
}
