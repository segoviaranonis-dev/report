"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import { importacionPasoMeta } from "@/lib/motor-precios/importacion-pasos";
import { IMPORTACION_PRECIOS, MOTOR_PRECIOS } from "@/lib/report/routes";
import { ImportacionPreciosStepNav } from "../../components/ImportacionPreciosStepNav";

type Props = {
  paso: number;
};

export function ImportacionPreciosPasoShellClient({ paso }: Props) {
  const sp = useSearchParams();
  const eventoId = Number(sp.get("evento_id") ?? "") || null;
  const meta = importacionPasoMeta(paso);

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader active="proceso-importacion" />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link href={IMPORTACION_PRECIOS} className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Importación de precios
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">
          2.3.1.7.2.{paso} · {meta.label}
        </p>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">{meta.label}</h1>

        <div className="mt-6">
          <ImportacionPreciosStepNav pasoActivo={paso} eventoId={eventoId} />
        </div>

        <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 px-5 py-6 text-sm text-amber-950">
          <p className="font-bold text-base">Paso {paso} en construcción</p>
          <p className="mt-2 leading-relaxed">
            {meta.desc}. Paridad Streamlit pendiente — usá los botones arriba para moverte entre pasos del flujo.
          </p>
          {eventoId ? (
            <p className="mt-3 font-mono text-xs">evento_id={eventoId}</p>
          ) : (
            <p className="mt-3 text-xs font-semibold">Volvé al Paso 0 y cargá el Excel para crear el evento.</p>
          )}
        </div>

        <Link href={MOTOR_PRECIOS} className="mt-8 inline-block text-sm font-semibold text-rimec-azul hover:underline">
          ← Motor de precios
        </Link>
      </main>
      <ReportFooter note={`Importación precios · Paso ${paso} · 2.3.1.7.2`} />
    </div>
  );
}
