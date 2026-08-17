"use client";

import { useMemo, useState } from "react";
import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import type { VentaCompradorLinea } from "@/lib/clientes/etiqueta-comprador";
import { agruparPeImportadora } from "@/lib/depositos/agrupar-pe-importadora";
import type { GrillaLoteModo } from "@/lib/panel-control/grilla-carga-lotes";
import { useGrillaLoteScroll } from "@/components/panel-control/useGrillaLoteScroll";
import { PeCardMiniatura } from "./PeCardMiniatura";
import { useStockPe } from "./StockPeContext";

type Props = {
  productos: DepositoRow[];
  casoPorLinea?: Map<string, string> | null;
  /** PE — cadena diccionario (sin biblioteca BCL) */
  showDiccionarioBadge?: boolean;
  showLlegada?: boolean;
  showVentas?: boolean;
  ventasPorMol?: Map<string, VentaCompradorLinea[]> | null;
  /** unitario = 30 tarjetas · pe-dual-ramo = 30 calzado + 30 confecciones */
  loteModo?: GrillaLoteModo;
  /** molécula L-R-mat-color → % dictado */
  descuentoPctPorMol?: Map<string, number> | null;
};

export function GrillaPeImportadora({
  productos,
  casoPorLinea = null,
  showLlegada = false,
  showVentas = false,
  ventasPorMol = null,
  loteModo = "unitario",
  showDiccionarioBadge = false,
  descuentoPctPorMol = null,
}: Props) {
  const { tonoCatalog, applyTonoLocal, applyLrLocal, opciones } = useStockPe();
  const [expandAll, setExpandAll] = useState(false);
  const cards = useMemo(
    () =>
      agruparPeImportadora(productos, casoPorLinea, {
        ordenVentas: showVentas,
        ventasPorMol,
      }),
    [productos, casoPorLinea, showVentas, ventasPorMol],
  );

  const { visibleCards, totalProductos, visibleCount, hasMore, cargarMas, sentinelRef } =
    useGrillaLoteScroll({ cards, modo: loteModo });

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
          {totalProductos.toLocaleString("es-PY")} productos · 4 pilares + JPG · 1 tarjeta c/u
          {" · orden línea·referencia A→Z"}
          {visibleCount < totalProductos
            ? ` · mostrando ${visibleCount.toLocaleString("es-PY")}`
            : null}
          {" · "}
          {expandAll ? "tarjetas extendidas" : "tarjetas compactas"}
        </p>
        <button
          type="button"
          onClick={() => setExpandAll((v) => !v)}
          aria-pressed={expandAll}
          aria-label={expandAll ? "Compactar todas las tarjetas" : "Extender todos los datos"}
          className={`min-h-[40px] rounded-xl border px-4 text-xs font-bold transition ${
            expandAll
              ? "border-bazzar-naranja bg-bazzar-naranja text-white"
              : "border-bazzar-naranja/40 bg-white text-bazzar-naranja-dark hover:bg-orange-50"
          }`}
        >
          {expandAll ? "▾ Compactar tarjetas" : "▸ Extender todos los datos"}
        </button>
      </div>

      <div className="grid auto-rows-min grid-cols-2 items-start gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {visibleCards.map((card) => (
          <PeCardMiniatura
            key={card.key}
            card={card}
            expanded={expandAll}
            showCasoBadge={!!casoPorLinea?.size && !showDiccionarioBadge}
            showDiccionarioBadge={showDiccionarioBadge}
            showLlegada={showLlegada}
            showVentas={showVentas}
            descuentoPct={descuentoPctPorMol?.get(card.key) ?? null}
            enableTonoEdit
            tonoCatalog={tonoCatalog}
            onTonoPatched={applyTonoLocal}
            enableLrEdit
            estiloOptions={opciones.estilos}
            tipo1Options={opciones.tipo1.filter((t) => t.id > 0)}
            onLrPatched={applyLrLocal}
          />
        ))}
      </div>

      {hasMore ? (
        <div ref={sentinelRef} className="mt-6 flex flex-col items-center gap-2 py-4">
          <p className="text-xs text-slate-400">Cargando más productos…</p>
          <button
            type="button"
            onClick={cargarMas}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:border-rimec-azul hover:text-rimec-azul"
          >
            Ver más productos
          </button>
        </div>
      ) : null}
    </div>
  );
}
