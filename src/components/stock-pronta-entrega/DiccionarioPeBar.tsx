"use client";

import { useMemo } from "react";
import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import { buildEntradasDiccionarioPe } from "@/lib/stock-pronta-entrega/diccionario-pe";

type Props = {
  rows: DepositoRow[];
  claveActiva: string | null;
  onClaveChange: (clave: string | null) => void;
};

function pillActiva(clave: string): string {
  if (clave === "LIQUIDACION") {
    return "catalog-card-casino-oro border-amber-600 bg-amber-500 text-amber-950";
  }
  if (clave === "PROMOCIONAL") {
    return "catalog-card-casino-fucsia border-fuchsia-600 bg-fuchsia-600 text-white";
  }
  if (clave === "COMUN") {
    return "border-emerald-700 bg-emerald-600 text-white";
  }
  return "border-slate-600 bg-slate-700 text-white";
}

/** Barra diccionario PE — grupo uno · trillizo visual con Web. */
export function DiccionarioPeBar({ rows, claveActiva, onClaveChange }: Props) {
  const entradas = useMemo(() => buildEntradasDiccionarioPe(rows), [rows]);
  const totalArts = entradas.reduce((s, e) => s + e.articulos, 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
            DICCIONARIO PRONTA ENTREGA
          </p>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            COD.GRUPO SDRM · DESCUENTOS Y DIVISIÓN FI · SIN MOTOR PRECIOS
          </p>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onClaveChange(null)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase ${
              !claveActiva
                ? "border-slate-700 bg-slate-800 text-white"
                : "border-gray-300 bg-white text-gray-700 hover:border-slate-400"
            }`}
          >
            Todos ({totalArts.toLocaleString("es-PY")})
          </button>
          {entradas.map((e) => (
            <button
              key={e.clave}
              type="button"
              disabled={e.articulos === 0}
              title={e.articulos === 0 ? "Sin stock en lote activo" : undefined}
              onClick={() => onClaveChange(claveActiva === e.clave ? null : e.clave)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase ${
                e.articulos === 0
                  ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400"
                  : claveActiva === e.clave
                    ? pillActiva(e.clave)
                    : "border-gray-300 bg-white text-gray-700 hover:border-slate-400"
              }`}
            >
              {e.etiqueta} ({e.articulos.toLocaleString("es-PY")})
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
