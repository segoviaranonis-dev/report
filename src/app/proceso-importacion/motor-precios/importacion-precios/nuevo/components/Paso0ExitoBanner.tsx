"use client";

import type { RefObject } from "react";

type Props = {
  bannerRef?: RefObject<HTMLDivElement | null>;
  eventoId: number;
  skusCount: number;
  marcasCount: number;
  asignaciones: Record<string, string>;
};

export function Paso0ExitoBanner({ bannerRef, eventoId, skusCount, marcasCount, asignaciones }: Props) {
  return (
    <div
      ref={bannerRef}
      className="mt-6 overflow-hidden rounded-xl border border-emerald-300 bg-emerald-50 shadow-lg animate-in fade-in slide-in-from-top-4 zoom-in-95 duration-500"
    >
      <div className="flex items-start gap-4 px-5 py-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md animate-in zoom-in duration-500 delay-150">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="min-w-0 flex-1 text-sm text-emerald-950">
          <p className="font-serif text-xl font-bold text-emerald-900">Evento creado correctamente</p>
          <p className="mt-1 text-emerald-800">
            ID <span className="font-mono font-bold">{eventoId}</span> · {skusCount} SKUs · {marcasCount} marcas
          </p>
          <p className="mt-2 text-xs leading-relaxed text-emerald-800/90">
            Ley género:{" "}
            {Object.entries(asignaciones)
              .map(([m, g]) => `${m}→${g}`)
              .join(" · ")}
          </p>
          <p className="mt-3 rounded-lg bg-emerald-100/80 px-3 py-2 text-xs text-emerald-900">
            Siguiente: Memoria — asigná la biblioteca de casos que acompaña este listado (solo FK).
          </p>
        </div>
      </div>
    </div>
  );
}
