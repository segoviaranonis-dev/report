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
  valorInventario?: number;
  hideCategoria?: boolean;
  emptyFilters?: OperativaFilterState;
  /** importadora = curva POS; operativa = tallas Bazzar */
  gradaVariant?: "operativa" | "importadora";
  extraFilters?: React.ReactNode;
  /** PE: filtros cerrados, sin bloque hero vitales */
  filtersDefaultOpen?: boolean;
  hideVitalesHero?: boolean;
  hideProductosVital?: boolean;
  /** PE importadora: categoría antes de depósito y pilares */
  categoriaFirst?: boolean;
  /** PE: pares/Gs prominentes + botón colapsar estilo tablet */
  summaryLayout?: "default" | "vitales-first";
  /** PE: Calzado/Confecciones trascendental en barra colapsada (no fila chips) */
  categoriaEnCabecera?: boolean;
  /** PE: pills extra junto a pares/Gs (venta demo) */
  summaryTrailing?: React.ReactNode;
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

function CategoriaTrascendentalToggle({
  selected,
  onChange,
}: {
  selected: number[];
  onChange: React.Dispatch<React.SetStateAction<OperativaFilterState>>;
}) {
  const pick = (id: number) => {
    onChange((prev) => {
      if (prev.tipoV2Ids.length === 1 && prev.tipoV2Ids[0] === id) {
        return { ...prev, tipoV2Ids: [] };
      }
      return { ...prev, tipoV2Ids: [id] };
    });
  };

  const btn = (id: number, emoji: string, label: string) => {
    const active = selected.length === 1 && selected[0] === id;
    const all = selected.length === 0;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          pick(id);
        }}
        className={`rounded-xl px-4 py-2.5 text-sm font-black uppercase tracking-wide transition sm:px-7 sm:py-3 sm:text-base ${
          active
            ? "bg-bazzar-naranja text-white shadow-md ring-2 ring-bazzar-naranja/40"
            : all
              ? "bg-white text-bazzar-naranja-dark hover:bg-orange-50"
              : "bg-white/80 text-slate-600 hover:bg-orange-50"
        }`}
      >
        {emoji} {label}
      </button>
    );
  };

  return (
    <div
      className="inline-flex max-w-full flex-wrap justify-center gap-1 rounded-2xl border-2 border-bazzar-naranja/35 bg-gradient-to-r from-orange-50 via-white to-orange-50 p-1 shadow-sm"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="group"
      aria-label="Categoría · Calzado o Confecciones"
    >
      {btn(1, "👟", "Calzado")}
      {btn(2, "👕", "Confecciones")}
    </div>
  );
}

/** CABECERA DE FILTROS — un solo acordeón (título general); filas planas adentro */
export function TrianguloHeaderDeposito({
  filtros,
  onChange,
  opciones,
  tonoCatalog,
  totalProductos,
  totalPares,
  valorInventario = 0,
  hideCategoria = false,
  emptyFilters = EMPTY_OPERATIVA_FILTERS,
  gradaVariant = "operativa",
  extraFilters,
  filtersDefaultOpen = true,
  hideVitalesHero = false,
  hideProductosVital = false,
  categoriaFirst = false,
  summaryLayout = "default",
  categoriaEnCabecera = false,
  summaryTrailing,
}: Props) {
  const patch = (p: Partial<OperativaFilterState>) =>
    onChange((prev) => ({ ...prev, ...p }));

  const hayFiltros =
    filtros.generoIds.length > 0 ||
    filtros.marcaIds.length > 0 ||
    filtros.grupoEstiloIds.length > 0 ||
    filtros.tipo1Ids.length > 0 ||
    (!hideCategoria && filtros.tipoV2Ids.length > 0) ||
    filtros.lineaIds.length > 0 ||
    filtros.tonos.length > 0 ||
    filtros.sinTono ||
    !!filtros.q.trim() ||
    filtros.gradas.length > 0 ||
    (filtros.cantidadOp != null && filtros.cantidadValor != null) ||
    JSON.stringify(filtros) !== JSON.stringify(emptyFilters);

  const filaCategoria =
    !hideCategoria && !categoriaEnCabecera ? (
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
  ) : null;

  const vitalesFirst = summaryLayout === "vitales-first";

  return (
    <div
      className="mx-auto max-w-7xl px-4"
      role="search"
      aria-label="CABECERA DE FILTROS — Depósito Bazzar"
    >
      <details
        open={filtersDefaultOpen}
        className="group rounded-2xl border border-orange-100 bg-gradient-to-b from-white to-orange-50/30 shadow-sm ring-1 ring-orange-100/80"
      >
        <summary className="cursor-pointer list-none px-4 py-3 [&::-webkit-details-marker]:hidden">
          {vitalesFirst ? (
            <div className="flex flex-col gap-2">
              {categoriaEnCabecera ? (
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-bazzar-naranja/40 bg-white text-lg text-bazzar-naranja shadow-sm transition group-open:rotate-180"
                    aria-hidden
                  >
                    ▾
                  </span>
                  <div className="flex min-w-0 flex-1 justify-center">
                    <CategoriaTrascendentalToggle
                      selected={filtros.tipoV2Ids}
                      onChange={onChange}
                    />
                  </div>
                </div>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
                  {!categoriaEnCabecera ? (
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-bazzar-naranja/40 bg-white text-lg text-bazzar-naranja shadow-sm transition group-open:rotate-180"
                      aria-hidden
                    >
                      ▾
                    </span>
                  ) : null}
                  <VitalesStockDeposito
                    productos={totalProductos}
                    pares={totalPares}
                    valorInventario={valorInventario}
                    variant="prominent"
                    hideProductos={hideProductosVital}
                  />
                  {summaryTrailing}
                  {!categoriaEnCabecera ? (
                    <p className="hidden text-[10px] font-bold uppercase tracking-[0.18em] text-bazzar-naranja/70 sm:block">
                      Filtros
                    </p>
                  ) : null}
                </div>
                {hayFiltros && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onChange(emptyFilters);
                    }}
                    className="min-h-[44px] shrink-0 rounded-xl border border-red-200 bg-white px-4 text-xs font-semibold text-red-700 active:bg-red-50"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            </div>
          ) : (
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
                    valorInventario={valorInventario}
                    variant="inline"
                    hideProductos={hideProductosVital}
                  />
                </div>
              </div>
              {hayFiltros && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(emptyFilters);
                  }}
                  className="min-h-[44px] shrink-0 rounded-xl border border-red-200 bg-white px-4 text-xs font-semibold text-red-700 active:bg-red-50"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          )}
        </summary>

        <div className="space-y-3 border-t border-orange-100 px-4 pb-4 pt-3">
          {!hideVitalesHero && (
            <VitalesStockDeposito
              productos={totalProductos}
              pares={totalPares}
              valorInventario={valorInventario}
              variant="hero"
              hideProductos={hideProductosVital}
            />
          )}

          {categoriaFirst && !categoriaEnCabecera ? filaCategoria : null}
          {extraFilters}

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
          {!categoriaFirst && !categoriaEnCabecera ? filaCategoria : null}
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

          {gradaVariant === "importadora" ? null : (
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
          )}
        </div>
      </details>
    </div>
  );
}
