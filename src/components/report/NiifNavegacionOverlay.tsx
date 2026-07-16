"use client";

import { RimecCargandoPantalla } from "@/components/report/RimecCargandoPantalla";
import type { NiifNavPreset } from "@/lib/niif/navigation-latency";

type Props = NiifNavPreset & {
  open: boolean;
};

/** Overlay NIIF full-screen — animación RIMEC tras latencia NAV-500. */
export function NiifNavegacionOverlay({ open, mensaje, subtitulo, etapas }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-app-bg/92 px-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-label={mensaje}
    >
      <RimecCargandoPantalla
        className="w-full max-w-lg shadow-2xl"
        mensaje={mensaje}
        subtitulo={subtitulo}
        etapas={etapas}
      />
    </div>
  );
}
