"use client";

import Link from "next/link";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import { EjecutarProtocoloImportacionPreciosButton } from "@/components/motor-precios/EjecutarProtocoloImportacionPreciosButton";
import { BIBLIOTECA_CANONICA_LABEL } from "@/lib/motor-precios/constants";
import {
  IMPORTACION_PRECIOS,
  MOTOR_BIBLIOTECA,
  MOTOR_BIBLIOTECA_NUEVA,
  PROCESO_IMPORTACION,
} from "@/lib/report/routes";

type CardEstado = "activo" | "transito";

type Card = {
  href: string;
  code: string;
  title: string;
  desc: string;
  icon: string;
  estado?: CardEstado;
};

const CARDS: Card[] = [
  {
    href: MOTOR_BIBLIOTECA_NUEVA,
    code: "2.3.1.7.1.2",
    title: "Crear biblioteca de precios",
    desc: "Alta de maestro biblioteca_precio · casos comerciales por proveedor.",
    icon: "➕",
    estado: "activo",
  },
  {
    href: MOTOR_BIBLIOTECA,
    code: "2.3.1.7.1.1",
    title: "Biblioteca de precios",
    desc: `Histórico activo · referencia canónica ${BIBLIOTECA_CANONICA_LABEL}.`,
    icon: "📚",
    estado: "activo",
  },
  {
    href: IMPORTACION_PRECIOS,
    code: "2.3.1.7.2",
    title: "Importación de precios",
    desc: "Corazón 2 · Excel proveedor → evento → precio_lista · Pasos 0–5.",
    icon: "📥",
    estado: "transito",
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
          Corazón 1 (biblioteca) + Corazón 2 (importación Excel). Paridad Streamlit{" "}
          <code className="text-sm">rimec_engine</code>.
        </p>

        <div className="mt-6 rounded-xl border-2 border-rimec-azul/20 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rimec-azul/70">
            Protocolo · 2.3.1.7.2
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Ejecutar importación de precios (Pasos 0–5) — habilitado solo Nivel Dios.
          </p>
          <div className="mt-3">
            <EjecutarProtocoloImportacionPreciosButton />
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {CARDS.map((c) => {
            const isTransito = c.estado === "transito";
            const border = isTransito
              ? "border-amber-200 hover:border-rimec-azul/40"
              : "border-rimec-azul/20 hover:border-rimec-azul";

            return (
              <Link
                key={c.href}
                href={c.href}
                className={`group relative rounded-xl border-2 bg-white p-6 shadow-sm transition hover:shadow-md ${border}`}
              >
                {isTransito && (
                  <span className="absolute right-3 top-3 rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
                    Tránsito
                  </span>
                )}
                <div className="text-3xl">{c.icon}</div>
                <p className="mt-2 text-xs font-semibold text-rimec-azul/70">{c.code}</p>
                <h2 className="mt-1 font-serif text-xl font-semibold text-rimec-azul-dark group-hover:text-rimec-azul">
                  {c.title}
                </h2>
                <p className="mt-2 text-sm text-neutral-600">{c.desc}</p>
              </Link>
            );
          })}
        </div>

        <Link
          href={PROCESO_IMPORTACION}
          className="mt-8 inline-block text-sm font-semibold text-rimec-azul hover:underline"
        >
          ← Ciclo de importación
        </Link>
      </main>
      <ReportFooter note="Motor de precios · 2.3.1.7.1" />
    </div>
  );
}
