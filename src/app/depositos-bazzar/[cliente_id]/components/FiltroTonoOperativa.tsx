"use client";

import {
  COLORES_ESTANDAR_DEFAULT,
  estandarToTono,
  type ColorEstandar,
} from "@/lib/pilares/colores-estandar";
import { tonoCircleStyle } from "@/lib/pilares/color-canon";
import { toggleOperativaLabel } from "@/lib/depositos/operativa-filters";

type Props = {
  catalog?: ColorEstandar[];
  tonos: string[];
  sinTono: boolean;
  onChange: (patch: { tonos?: string[]; sinTono?: boolean }) => void;
  /** Dentro de acordeón CABECERA DE FILTROS — sin fila label duplicada */
  embedded?: boolean;
};

export function FiltroTonoOperativa({
  catalog = COLORES_ESTANDAR_DEFAULT,
  tonos,
  sinTono,
  onChange,
  embedded = false,
}: Props) {
  const items = catalog;

  const body = (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChange({ tonos: [], sinTono: false })}
          aria-label="Todos los tonos"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 p-0 ${
            !sinTono && tonos.length === 0
              ? "border-bazzar-naranja ring-2 ring-bazzar-naranja/30"
              : "border-gray-300"
          }`}
        >
          <span className="block h-6 w-6 rounded-full bg-[conic-gradient(red,yellow,green,blue,magenta,red)]" />
        </button>

        <button
          type="button"
          onClick={() => onChange({ sinTono: !sinTono, tonos: [] })}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
            sinTono
              ? "border-bazzar-naranja bg-bazzar-naranja text-white"
              : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          Sin asignar
        </button>

        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5 snap-x">
          {items.map((c) => {
            const on = tonos.includes(c.etiqueta);
            const t = estandarToTono(c);
            return (
              <button
                key={c.etiqueta}
                type="button"
                onClick={() =>
                  onChange({
                    sinTono: false,
                    tonos: toggleOperativaLabel(tonos, c.etiqueta),
                  })
                }
                aria-label={`TONO ${c.etiqueta}`}
                className={`flex h-9 w-9 shrink-0 snap-center items-center justify-center rounded-full border-2 p-0 ${
                  on ? "border-bazzar-naranja ring-2 ring-bazzar-naranja/30" : "border-gray-200"
                }`}
              >
                <span className="block h-6 w-6 rounded-full" style={tonoCircleStyle(t)} />
              </button>
            );
          })}
        </div>
      </div>
  );

  if (embedded) return body;

  return (
    <div className="flex flex-col gap-1.5 border-t border-gray-100 pt-3 sm:flex-row sm:items-start sm:gap-3">
      <span className="w-16 shrink-0 pt-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Tono
      </span>
      {body}
    </div>
  );
}
