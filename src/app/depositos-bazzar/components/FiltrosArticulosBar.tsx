"use client";

import type { Dispatch, SetStateAction } from "react";
import type { DepositoFilterItem } from "@/app/api/depositos/[cliente_id]/filtros/route";
import type { ColorEstandar } from "@/lib/pilares/colores-estandar";
import { useDepositoCalzado } from "@/app/depositos-bazzar/context/DepositoCalzadoContext";
import {
  normFk,
  toggleOperativaId,
  type OperativaFilterState,
  type OperativaOpciones,
} from "@/lib/depositos/operativa-filters";
import { FiltroTonoOperativa } from "./operativa/FiltroTonoOperativa";

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 snap-center rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "border-bazzar-naranja bg-bazzar-naranja text-white"
          : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

function FilaChips({
  label,
  todosLabel,
  items,
  selected,
  onToggle,
  onClear,
}: {
  label: string;
  todosLabel: string;
  items: DepositoFilterItem[];
  selected: number[];
  onToggle: (id: number | string) => void;
  onClear: () => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
      <span className="w-16 shrink-0 pt-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5 snap-x">
        <Pill active={selected.length === 0} onClick={onClear}>
          {todosLabel}
        </Pill>
        {items.map((item) => {
          const id = normFk(item.id);
          if (id == null) return null;
          return (
            <Pill key={id} active={selected.includes(id)} onClick={() => onToggle(id)}>
              <span className="block max-w-[140px] truncate">{item.label}</span>
            </Pill>
          );
        })}
      </div>
    </div>
  );
}

function cap(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function hayFiltrosArticulos(f: OperativaFilterState): boolean {
  return (
    f.marcaIds.length > 0 ||
    f.grupoEstiloIds.length > 0 ||
    f.tonos.length > 0 ||
    f.sinTono
  );
}

export type FiltrosArticulosBarViewProps = {
  tonoCatalog?: ColorEstandar[];
  filtros: OperativaFilterState;
  setFiltros: Dispatch<SetStateAction<OperativaFilterState>>;
  opciones: OperativaOpciones;
  totalPares: number;
  cardsCount: number;
};

export function FiltrosArticulosBarView({
  tonoCatalog,
  filtros,
  setFiltros,
  opciones,
  totalPares,
  cardsCount,
}: FiltrosArticulosBarViewProps) {
  const patch = (p: Partial<OperativaFilterState>) =>
    setFiltros((prev) => ({ ...prev, ...p }));

  const activos = hayFiltrosArticulos(filtros);

  return (
    <div
      className="rounded-xl border border-orange-100 bg-gradient-to-b from-white to-orange-50/40 p-4 shadow-sm"
      role="search"
      aria-label="Filtros artículos — marca estilo tono"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-bazzar-naranja">
            Filtros · sincronizados con Operativa
          </p>
          <p className="text-xs text-report-muted">
            {cardsCount} cajas ·{" "}
            <span className="font-bold tabular-nums text-bazzar-naranja">
              {totalPares.toLocaleString("es-PY")} p
            </span>
          </p>
        </div>
        {activos && (
          <button
            type="button"
            onClick={() =>
              setFiltros((prev) => ({
                ...prev,
                marcaIds: [],
                grupoEstiloIds: [],
                tonos: [],
                sinTono: false,
              }))
            }
            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700"
          >
            Limpiar marca/estilo/tono
          </button>
        )}
      </div>

      <div className="space-y-3">
        <FilaChips
          label="Marca"
          todosLabel="Todas"
          items={opciones.marcas.map((m) => ({ ...m, label: cap(m.label) }))}
          selected={filtros.marcaIds}
          onToggle={(id) =>
            setFiltros((prev) => ({
              ...prev,
              marcaIds: toggleOperativaId(prev.marcaIds, id),
            }))
          }
          onClear={() => patch({ marcaIds: [] })}
        />
        <FilaChips
          label="Estilo"
          todosLabel="Todos"
          items={opciones.estilos}
          selected={filtros.grupoEstiloIds}
          onToggle={(id) =>
            setFiltros((prev) => ({
              ...prev,
              grupoEstiloIds: toggleOperativaId(prev.grupoEstiloIds, id),
            }))
          }
          onClear={() => patch({ grupoEstiloIds: [] })}
        />
        <FiltroTonoOperativa
          catalog={tonoCatalog}
          tonos={filtros.tonos}
          sinTono={filtros.sinTono}
          onChange={(p) => patch(p)}
        />
      </div>
    </div>
  );
}

type Props = {
  tonoCatalog?: ColorEstandar[];
};

/** Marca · estilo · tono — mismo estado que Operativa (gemelos siameses). */
export function FiltrosArticulosBar({ tonoCatalog }: Props) {
  const { filtros, setFiltros, opciones, totalPares, cardsCount } = useDepositoCalzado();
  return (
    <FiltrosArticulosBarView
      tonoCatalog={tonoCatalog}
      filtros={filtros}
      setFiltros={setFiltros}
      opciones={opciones}
      totalPares={totalPares}
      cardsCount={cardsCount}
    />
  );
}
