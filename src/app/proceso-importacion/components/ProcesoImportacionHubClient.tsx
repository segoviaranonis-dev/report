"use client";

import Link from "next/link";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import {
  IMPORTACION_PRECIOS,
  MOTOR_PRECIOS,
  PROCESO_IMPORTACION,
} from "@/lib/report/routes";

const SUBPROCESOS = [
  {
    href: MOTOR_PRECIOS,
    code: "2.3.1.7.1",
    codeProceso: "P.1.1",
    title: "Motor de precios",
    desc: "Corazón 1 — Biblioteca de casos · crear / histórico / editor (1905).",
    icon: "⚙️",
    estado: "activo" as const,
  },
  {
    href: IMPORTACION_PRECIOS,
    code: "2.3.1.7.2",
    codeProceso: "P.1.2",
    title: "Importación de precios",
    desc: "Corazón 2 — Excel proveedor → evento → precio_lista. Mudanza Paso 0–6 Streamlit.",
    icon: "📥",
    estado: "proximo" as const,
  },
];

const PLANIFICADOS = [
  "Pedido proveedor (PP)",
  "Intención de compra (IC)",
  "Digitación",
  "Importación proforma",
  "Vinculación listado ↔ PP ↔ FI",
];

export function ProcesoImportacionHubClient() {
  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader active="proceso-importacion" />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">
          RIMEC · Report · {PROCESO_IMPORTACION}
        </p>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">Proceso de importación</h1>
        <p className="mt-3 max-w-2xl text-neutral-700">
          Procesos que mutan pilares, listados y Excel → BD. Construcción en paralelo a Streamlit (soporte vital de
          RIMEC Web) con UI NIIF y documentación Moria.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {SUBPROCESOS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className={`group relative rounded-xl border-2 bg-white p-6 shadow-sm transition hover:shadow-md ${
                s.estado === "activo"
                  ? "border-rimec-azul/20 hover:border-rimec-azul"
                  : "border-dashed border-slate-300 hover:border-rimec-azul/40"
              }`}
            >
              {s.estado === "proximo" && (
                <span className="absolute right-3 top-3 rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
                  Próximo
                </span>
              )}
              <div className="text-3xl">{s.icon}</div>
              <p className="mt-2 text-xs font-semibold text-rimec-azul/70">{s.code}</p>
              <p className="text-[10px] text-slate-500">{s.codeProceso}</p>
              <h2 className="mt-1 font-serif text-xl font-semibold text-rimec-azul-dark group-hover:text-rimec-azul">
                {s.title}
              </h2>
              <p className="mt-2 text-sm text-neutral-600">{s.desc}</p>
            </Link>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <strong>Subprocesos planificados</strong> (documentación Moria · etapas siguientes):{" "}
          {PLANIFICADOS.join(" · ")}
        </div>

        <Link href="/" className="mt-8 inline-block text-sm font-semibold text-rimec-azul hover:underline">
          ← Inicio Report
        </Link>
      </main>
      <ReportFooter note="Proceso de importación · 2.3.1.7 · RIMEC" />
    </div>
  );
}
