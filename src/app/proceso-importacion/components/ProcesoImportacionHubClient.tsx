"use client";

import Link from "next/link";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import {
  DIGITACION,
  INTENCION_COMPRA,
  MOTOR_PRECIOS,
  PEDIDO_PROVEEDOR,
  PROCESO_IMPORTACION,
} from "@/lib/report/routes";

type Estado = "activo" | "transito" | "proximo";

type Subproceso = {
  href: string;
  code: string;
  codeProceso: string;
  title: string;
  desc: string;
  icon: string;
  estado: Estado;
};

/** Ciclo Streamlit: comercial (7.1–7.5) + abastecimiento (7.6–7.8) */
const CICLO_IMPORTACION: Subproceso[] = [
  {
    href: MOTOR_PRECIOS,
    code: "2.3.1.7.1",
    codeProceso: "P.1.1",
    title: "Motor de precios",
    desc: "Biblioteca casos · importación Excel · listas LPN / LPC03 / LPC04.",
    icon: "⚙️",
    estado: "activo",
  },
  {
    href: INTENCION_COMPRA,
    code: "2.3.1.7.3",
    codeProceso: "P.1.4",
    title: "Intención de compra",
    desc: "Cabecera financiera · cuotas por marca · límite de crédito.",
    icon: "📋",
    estado: "transito",
  },
  {
    href: DIGITACION,
    code: "2.3.1.7.4",
    codeProceso: "P.1.5",
    title: "Digitación",
    desc: "Nro. fábrica a ICs autorizadas · agrupa en Pedidos Proveedor.",
    icon: "⌨️",
    estado: "transito",
  },
  {
    href: PEDIDO_PROVEEDOR,
    code: "2.3.1.7.5",
    codeProceso: "P.1.3",
    title: "Pedido proveedor",
    desc: "SKUs F9 · gradaciones · proformas · ventas en tránsito.",
    icon: "📦",
    estado: "transito",
  },
];

const BADGE: Record<Estado, { label: string; className: string } | null> = {
  activo: null,
  transito: { label: "Tránsito", className: "bg-amber-100 text-amber-900" },
  proximo: { label: "Próximo", className: "bg-slate-200 text-slate-700" },
};

export function ProcesoImportacionHubClient() {
  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader active="proceso-importacion" />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">
          RIMEC · Report · {PROCESO_IMPORTACION}
        </p>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">Ciclo de importación</h1>
        <p className="mt-3 max-w-3xl text-neutral-700">
          Motor de precios · flujo completo desde intención hasta depósito. Paridad Streamlit con UI NIIF en Report.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CICLO_IMPORTACION.map((s) => {
            const badge = BADGE[s.estado];
            const border =
              s.estado === "activo"
                ? "border-rimec-azul/20 hover:border-rimec-azul"
                : s.estado === "transito"
                  ? "border-amber-200 hover:border-rimec-azul/40"
                  : "border-dashed border-slate-300 hover:border-rimec-azul/40";

            return (
              <Link
                key={s.href}
                href={s.href}
                className={`group relative rounded-xl border-2 bg-white p-6 shadow-sm transition hover:shadow-md ${border}`}
              >
                {badge && (
                  <span
                    className={`absolute right-3 top-3 rounded px-2 py-0.5 text-xs font-bold ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                )}
                <div className="text-3xl">{s.icon}</div>
                <p className="mt-2 text-xs font-semibold text-rimec-azul/70">{s.code}</p>
                <p className="text-[10px] text-slate-500">{s.codeProceso}</p>
                <h2 className="mt-1 font-serif text-xl font-semibold text-rimec-azul-dark group-hover:text-rimec-azul">
                  {s.title}
                </h2>
                <p className="mt-2 text-sm text-neutral-600">{s.desc}</p>
                <span className="mt-4 inline-block text-sm font-semibold text-rimec-azul group-hover:underline">
                  Abrir →
                </span>
              </Link>
            );
          })}
        </div>

        <Link href="/" className="mt-8 inline-block text-sm font-semibold text-rimec-azul hover:underline">
          ← Inicio Report
        </Link>
      </main>
      <ReportFooter note="Ciclo de importación · 2.3.1.7 · RIMEC" />
    </div>
  );
}
