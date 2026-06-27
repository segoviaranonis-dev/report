"use client";

import type { DepositoFilterItem } from "@/app/api/depositos/[cliente_id]/filtros/route";
import type { ColorEstandar } from "@/lib/pilares/colores-estandar";
import {
  EMPTY_OPERATIVA_FILTERS,
  normFk,
  toggleOperativaId,
  type OperativaFilterState,
  type OperativaOpciones,
} from "@/lib/depositos/operativa-filters";
import { FiltroTonoOperativa } from "./FiltroTonoOperativa";
import { FiltroGradaOperativa } from "./FiltroGradaOperativa";
import { VitalesStockDeposito } from "./VitalesStockDeposito";

type Props = {
  filtros: OperativaFilterState;
  onChange: React.Dispatch<React.SetStateAction<OperativaFilterState>>;
  opciones: OperativaOpciones;
  tonoCatalog?: ColorEstandar[];
  totalProductos: number;
  totalPares: number;
};

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
      <span className="w-20 shrink-0 pt-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
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

/** CABECERA DE FILTROS — un solo acordeón (título general); filas planas adentro */
export function TrianguloHeaderDeposito({
  filtros,
  onChange,
  opciones,
  tonoCatalog,
  totalProductos,
  totalPares,
}: Props) {
  const patch = (p: Partial<OperativaFilterState>) =>
    onChange((prev) => ({ ...prev, ...p }));

  const hayFiltros =
    filtros.generoIds.length > 0 ||
    filtros.marcaIds.length > 0 ||
    filtros.grupoEstiloIds.length > 0 ||
    filtros.tipo1Ids.length > 0 ||
    filtros.tipoV2Ids.length > 0 ||
    filtros.lineaIds.length > 0 ||
    filtros.tonos.length > 0 ||
    filtros.sinTono ||
    !!filtros.q.trim() ||
    filtros.gradas.length > 0 ||
    (filtros.cantidadOp != null && filtros.cantidadValor != null);

  return (
    <div
      className="mx-auto max-w-7xl px-4"
      role="search"
      aria-label="CABECERA DE FILTROS — Depósito Bazzar"
    >
      <details
        open
        className="group rounded-2xl border border-orange-100 bg-gradient-to-b from-white to-orange-50/30 shadow-sm ring-1 ring-orange-100/80"
      >
        <summary className="cursor-pointer list-none px-4 py-3 [&::-webkit-details-marker]:hidden">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="text-sm text-bazzar-naranja transition group-open:rotate-180"
                aria-hidden
              >
                ▾
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-bazzar-naranja">
                  Cabecera de filtros
                </p>
                <VitalesStockDeposito
                  productos={totalProductos}
                  pares={totalPares}
                  variant="inline"
                />
              </div>
            </div>
            {hayFiltros && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(EMPTY_OPERATIVA_FILTERS);
                }}
                className="min-h-[44px] shrink-0 rounded-xl border border-red-200 bg-white px-4 text-xs font-semibold text-red-700 active:bg-red-50"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </summary>

        <div className="space-y-3 border-t border-orange-100 px-4 pb-4 pt-3">
          <VitalesStockDeposito productos={totalProductos} pares={totalPares} variant="hero" />

          <FilaChips
            label="Género"
            todosLabel="Todos"
            items={opciones.generos.map((g) => ({ ...g, label: cap(g.label) }))}
            selected={filtros.generoIds}
            onToggle={(id) =>
              onChange((prev) => ({
                ...prev,
                generoIds: toggleOperativaId(prev.generoIds, id),
              }))
            }
            onClear={() => patch({ generoIds: [] })}
          />
          <FilaChips
            label="Marca"
            todosLabel="Todas"
            items={opciones.marcas.map((m) => ({ ...m, label: cap(m.label) }))}
            selected={filtros.marcaIds}
            onToggle={(id) =>
              onChange((prev) => ({
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
              onChange((prev) => ({
                ...prev,
                grupoEstiloIds: toggleOperativaId(prev.grupoEstiloIds, id),
              }))
            }
            onClear={() => patch({ grupoEstiloIds: [] })}
          />
          <FilaChips
            label="Tipo 1"
            todosLabel="Todos"
            items={opciones.tipo1}
            selected={filtros.tipo1Ids}
            onToggle={(id) =>
              onChange((prev) => ({
                ...prev,
                tipo1Ids: toggleOperativaId(prev.tipo1Ids, id),
              }))
            }
            onClear={() => patch({ tipo1Ids: [] })}
          />
          <FilaChips
            label="Categoría"
            todosLabel="Todos"
            items={opciones.tipoV2}
            selected={filtros.tipoV2Ids}
            onToggle={(id) =>
              onChange((prev) => ({
                ...prev,
                tipoV2Ids: toggleOperativaId(prev.tipoV2Ids, id),
              }))
            }
            onClear={() => patch({ tipoV2Ids: [] })}
          />
          <FilaChips
            label="Línea"
            todosLabel="Todas"
            items={opciones.lineas}
            selected={filtros.lineaIds}
            onToggle={(id) =>
              onChange((prev) => ({
                ...prev,
                lineaIds: toggleOperativaId(prev.lineaIds, id),
              }))
            }
            onClear={() => patch({ lineaIds: [] })}
          />

          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
            <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Buscar
            </span>
            <input
              type="search"
              value={filtros.q}
              onChange={(e) => patch({ q: e.target.value })}
              placeholder="Línea, ref, marca, material, color…"
              className="min-h-[44px] flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-bazzar-naranja focus:outline-none focus:ring-2 focus:ring-bazzar-naranja/20"
            />
          </div>

          <FiltroTonoOperativa
            catalog={tonoCatalog}
            tonos={filtros.tonos}
            sinTono={filtros.sinTono}
            onChange={(p) => patch(p)}
          />

          <FiltroGradaOperativa
            applied={{ gradas: filtros.gradas }}
            gradasOpciones={opciones.gradas}
            onApply={(draft) =>
              onChange((prev) => ({
                ...prev,
                gradas: draft.gradas,
              }))
            }
          />
        </div>
      </details>
    </div>
  );
}
