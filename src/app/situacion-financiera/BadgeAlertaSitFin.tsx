"use client";

import { explicarAlerta } from "@/lib/situacion-financiera/alerta-inconsistencia";

type MapaFila = {
  molKey: string | null;
  origen: string;
  estado: string;
  excelGs: number | null;
  txtGs: number | null;
  canonGs: number | null;
  delta: number | null;
  archivo: string | null;
  label?: string | null;
  archivoExcel?: string | null;
  archivoTxt?: string | null;
};

/** Burbuja solo canon Guido ↔ TXT (sin SF AL). */
export function BadgeAlertaSitFin({
  badge,
  mapa,
  mesCtx,
  open,
  onToggle,
}: {
  badge: "Δ" | "TXT";
  mapa: MapaFila;
  mesCtx: string | null;
  open: boolean;
  onToggle: () => void;
}) {
  const ex = explicarAlerta(badge, { ...mapa, mesCtx });
  const esDescuadre = badge === "Δ";

  return (
    <span className="relative ml-1 inline-block align-middle">
      <button
        type="button"
        className={`rounded px-1.5 py-0.5 text-[11px] font-bold leading-none ${
          esDescuadre
            ? "bg-red-200 text-red-900 hover:bg-red-300"
            : "bg-emerald-200 text-emerald-900 hover:bg-emerald-300"
        }`}
        aria-label={ex.titulo}
        title="Integridad canon ↔ TXT"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        {esDescuadre ? "⚠ Δ" : "TXT"}
      </button>
      {open ? (
        <span
          role="dialog"
          className="absolute left-0 top-full z-40 mt-1.5 w-[24rem] max-w-[min(24rem,94vw)] rounded-lg border-2 border-slate-500 bg-white p-3 text-left text-[12px] font-normal normal-case leading-snug text-slate-900 shadow-xl sm:w-[28rem] sm:max-w-[28rem]"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="block text-[14px] font-bold text-[#1F4E79]">
            {ex.titulo}
          </span>
          <span className="mt-2 block text-[12px]">{ex.quePaso}</span>

          <span className="mt-3 block rounded border-2 border-amber-500 bg-amber-50 px-2 py-1.5">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-amber-900">
              Excel canon Guido
            </span>
            <span className="mt-0.5 block break-all font-mono text-[12px] font-semibold text-amber-950">
              {ex.archivoExcel}
            </span>
            <span className="mt-1 block tabular-nums text-[12px]">
              Monto canon: <strong>{ex.montoExcel}</strong>
            </span>
          </span>

          <span className="mt-2 block rounded border-2 border-emerald-500 bg-emerald-50 px-2 py-1.5">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-emerald-900">
              TXT limpio
            </span>
            <span className="mt-0.5 block break-all font-mono text-[12px] font-semibold text-emerald-950">
              {ex.archivoTxt}
            </span>
            <span className="mt-1 block tabular-nums text-[12px]">
              Monto TXT: <strong>{ex.montoTxt}</strong>
            </span>
          </span>

          <span className="mt-2 block space-y-0.5 text-[12px]">
            {esDescuadre ? (
              <span className="block">
                Diferencia (Δ):{" "}
                <strong className="text-red-800">{ex.delta}</strong>
              </span>
            ) : null}
            <span className="block">
              Lo que muestra Sit Fin:{" "}
              <strong className="text-emerald-900">{ex.muestraSitFin}</strong>
            </span>
          </span>

          <span className="mt-2 block rounded border border-sky-300 bg-sky-50 px-2 py-1.5 text-[12px] text-sky-950">
            <strong>Qué hacer:</strong> {ex.queHacer}
          </span>

          <button
            type="button"
            className="mt-2.5 text-[12px] font-semibold text-sky-800 underline"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            Cerrar
          </button>
        </span>
      ) : null}
    </span>
  );
}
