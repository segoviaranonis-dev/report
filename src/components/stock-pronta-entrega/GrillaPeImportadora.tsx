"use client";

import { useMemo, useState } from "react";
import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import { agruparPeImportadora } from "@/lib/depositos/agrupar-pe-importadora";
import { PeCardMiniatura } from "./PeCardMiniatura";

type Props = {
  productos: DepositoRow[];
  casoPorLinea?: Map<string, string> | null;
  showLlegada?: boolean;
  showVentas?: boolean;
};

export function GrillaPeImportadora({
  productos,
  casoPorLinea = null,
  showLlegada = false,
  showVentas = false,
}: Props) {
  const [expandAll, setExpandAll] = useState(false);
  const cards = useMemo(
    () => agruparPeImportadora(productos, casoPorLinea, { ordenVentas: showVentas }),
    [productos, casoPorLinea, showVentas],
  );

  if (cards.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-10 text-center">
        <p className="text-base text-gray-600">Sin productos o sin coincidencias con los filtros.</p>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {cards.length.toLocaleString("es-PY")} moléculas · 1 imagen c/u
          {showVentas ? " · orden por vendido" : " · orden por pares"}
        </p>
        <button
          type="button"
          onClick={() => setExpandAll((v) => !v)}
          aria-pressed={expandAll}
          className={`min-h-[40px] rounded-xl border px-4 text-xs font-bold transition ${
            expandAll
              ? "border-bazzar-naranja bg-bazzar-naranja text-white"
              : "border-bazzar-naranja/40 bg-white text-bazzar-naranja-dark hover:bg-orange-50"
          }`}
        >
          {expandAll ? "Compactar tarjetas" : "Extender todos los datos"}
        </button>
      </div>

      <div className="grid auto-rows-fr grid-cols-2 items-stretch gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {cards.map((card) => (
          <PeCardMiniatura
            key={card.key}
            card={card}
            expanded={expandAll}
            showCasoBadge={!!casoPorLinea?.size}
            showLlegada={showLlegada}
            showVentas={showVentas}
          />
        ))}
      </div>
    </div>
  );
}
