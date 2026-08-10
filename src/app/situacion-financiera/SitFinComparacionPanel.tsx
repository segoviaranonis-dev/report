"use client";

import {
  CMP_ARCHIVO_AGO,
  CMP_ARCHIVO_JUL,
  CMP_PATH_AGO,
  CMP_PATH_JUL,
  CMP_TASA_AGOSTO,
  CMP_TASA_JULIO,
} from "@/lib/situacion-financiera/cmp-usd-lookup";

type Props = {
  activo: boolean;
  onToggle: () => void;
};

/** Botón + leyenda. Columnas Jul/Ago/% = solo canones admin Guido. */
export function SitFinComparacionPanel({ activo, onToggle }: Props) {
  return (
    <div className="rounded border border-slate-300 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-serif text-sm font-semibold text-[#1F4E79]">
            Comparación Julio ↔ Agosto · canones Guido
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-600">
            Al activar: columnas <strong>Julio USD</strong> ·{" "}
            <strong>Agosto USD</strong> · <strong>% var.</strong> solo desde los
            dos Excels canónicos (no desde SF AL / TXT del legajo).
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
        <div className="mt-3 space-y-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-950">
          <strong>
            Canones · Jul tasa {CMP_TASA_JULIO} · Ago tasa {CMP_TASA_AGOSTO}
          </strong>
          <span className="block font-mono text-[10px] break-all">
            Julio: {CMP_PATH_JUL}
          </span>
          <span className="block font-mono text-[10px] break-all">
            Agosto: {CMP_PATH_AGO}
          </span>
          <span className="block">
            Archivos: <code className="rounded bg-white/80 px-1">{CMP_ARCHIVO_JUL}</code>
            {" ↔ "}
            <code className="rounded bg-white/80 px-1">{CMP_ARCHIVO_AGO}</code>
          </span>
          <span className="block text-amber-900/90">
            % = (Agosto canon USD − Julio canon USD) / |Julio|. Si SF AL o un TXT
            del legajo difieren, se verifica contra estos canones — Guido marca
            otros archivos del legajo como posibles errores.
          </span>
        </div>
      ) : null}
    </div>
  );
}
