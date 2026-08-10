"use client";

import {
  CMP_ARCHIVO_JUL,
  CMP_TASA_AGOSTO,
  CMP_TASA_JULIO,
} from "@/lib/situacion-financiera/cmp-usd-lookup";

type Props = {
  activo: boolean;
  onToggle: () => void;
};

/** Botón + leyenda. Las columnas Jul/Ago/% viven en la tabla Excel AL. */
export function SitFinComparacionPanel({ activo, onToggle }: Props) {
  return (
    <div className="rounded border border-slate-300 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-serif text-sm font-semibold text-[#1F4E79]">
            Comparación Julio ↔ Agosto · USD
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-600">
            Al activar, la tabla agrega 3 columnas:{" "}
            <strong>Julio USD</strong> · <strong>Agosto USD</strong> ·{" "}
            <strong>% variación</strong> (entre Concepto e Importe Gs).
          </p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            activo
              ? "bg-[#1F4E79] text-white"
              : "border border-[#1F4E79] bg-sky-50 text-[#1F4E79] hover:bg-sky-100"
          }`}
        >
          {activo ? "Ocultar comparación" : "Activar comparación"}
        </button>
      </div>

      {activo ? (
        <div className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-950">
          <strong>
            Columnas activas · Jul tasa {CMP_TASA_JULIO} · Ago tasa{" "}
            {CMP_TASA_AGOSTO}
          </strong>
          <span className="mt-1 block">
            Julio ={" "}
            <code className="rounded bg-white/80 px-1">{CMP_ARCHIVO_JUL}</code>
            {" · "}
            Agosto = Sit Fin isla (mapa + TXT). Solo bloque{" "}
            <strong>agosto</strong> se rellena; otros meses quedan vacíos.
          </span>
          <span className="mt-1 block text-amber-900/90">
            % = (Agosto USD − Julio USD) / |Julio USD| · no parchear deltas.
          </span>
        </div>
      ) : null}
    </div>
  );
}
