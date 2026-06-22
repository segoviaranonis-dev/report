"use client";

import Link from "next/link";
import { IMPORTACION_PASOS, importacionPasoPath } from "@/lib/motor-precios/importacion-pasos";
import { ImportacionPreciosProgressBar } from "./ImportacionPreciosProgressBar";

type Props = {
  pasoActivo: number;
  eventoId?: number | null;
  bloquearSiguiente?: boolean;
  mensajeSiguiente?: string;
};

export function ImportacionPreciosStepNav({
  pasoActivo,
  eventoId,
  bloquearSiguiente,
  mensajeSiguiente,
}: Props) {
  const prevPath = pasoActivo > 0 ? importacionPasoPath(pasoActivo - 1, eventoId) : null;
  const nextPath = pasoActivo < 4 ? importacionPasoPath(pasoActivo + 1, eventoId) : null;
  const meta = IMPORTACION_PASOS.find((p) => p.paso === pasoActivo);

  return (
    <div className="space-y-4">
      <ImportacionPreciosProgressBar pasoActivo={pasoActivo} eventoId={eventoId} />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Paso {pasoActivo} · {meta?.label}
          </p>
          {meta?.desc ? <p className="text-xs text-slate-600">{meta.desc}</p> : null}
        </div>
        <div className="flex gap-2">
          {prevPath ? (
            <Link
              href={prevPath}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Anterior
            </Link>
          ) : null}
          {nextPath ? (
            bloquearSiguiente ? (
              <span
                title={mensajeSiguiente}
                className="cursor-not-allowed rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-500"
              >
                Siguiente →
              </span>
            ) : (
              <Link
                href={nextPath}
                className="rounded-lg bg-rimec-azul px-4 py-2 text-sm font-bold text-white hover:bg-rimec-azul-dark"
              >
                Siguiente →
              </Link>
            )
          ) : null}
        </div>
      </div>
      {bloquearSiguiente && mensajeSiguiente ? (
        <p className="text-xs text-amber-800">{mensajeSiguiente}</p>
      ) : null}
    </div>
  );
}
