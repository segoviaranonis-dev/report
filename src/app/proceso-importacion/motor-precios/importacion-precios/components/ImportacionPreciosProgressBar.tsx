"use client";

import Link from "next/link";
import { IMPORTACION_PASOS, importacionPasoPath } from "@/lib/motor-precios/importacion-pasos";

type Props = {
  pasoActivo: number;
  eventoId?: number | null;
};

export function ImportacionPreciosProgressBar({ pasoActivo, eventoId }: Props) {
  return (
    <nav aria-label="Progreso importación" className="flex flex-wrap gap-1">
      {IMPORTACION_PASOS.map((p) => {
        const href = importacionPasoPath(p.paso, eventoId);
        const activo = p.paso === pasoActivo;
        const hecho = p.paso < pasoActivo;
        return (
          <Link
            key={p.paso}
            href={href}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              activo
                ? "bg-rimec-azul text-white"
                : hecho
                  ? "bg-emerald-100 text-emerald-900 hover:bg-emerald-200"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {p.paso}. {p.label}
          </Link>
        );
      })}
    </nav>
  );
}
