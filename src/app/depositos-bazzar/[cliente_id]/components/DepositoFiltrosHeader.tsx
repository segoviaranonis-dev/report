"use client";

import { useCallback } from "react";
import type { DepositoFilterState } from "@/lib/depositos/deposito-filters";
import type { DepositoFilterItem } from "@/app/api/depositos/[cliente_id]/filtros/route";

type FiltrosData = {
  generos: DepositoFilterItem[];
  marcas: DepositoFilterItem[];
  estilos: DepositoFilterItem[];
  tipoV2: DepositoFilterItem[];
};

type Props = {
  filtros: DepositoFilterState;
  onChange: (next: DepositoFilterState) => void;
  filtrosData: FiltrosData | null;
  ente: string;
  tipo: string;
  totalProductos: number;
  totalPares: number;
};

function cap(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

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
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

export function DepositoFiltrosHeader({
  filtros,
  onChange,
  filtrosData,
  ente,
  tipo,
  totalProductos,
  totalPares,
}: Props) {
  const patch = useCallback(
    (p: Partial<DepositoFilterState>) => onChange({ ...filtros, ...p }),
    [filtros, onChange]
  );

  const hayFiltros =
    !!filtros.tipoV2Id ||
    !!filtros.marcaId ||
    !!filtros.generoId ||
    !!filtros.grupoEstiloId ||
    filtros.lineaIds.length > 0 ||
    filtros.colorIds.length > 0 ||
    !!filtros.q.trim();

  return (
    <div className="mx-auto max-w-6xl px-4 pb-4">
      {/* Header */}
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-serif text-2xl font-bold text-gray-800">
            {ente} · {tipo}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            <span className="font-semibold text-blue-600">
              {totalProductos.toLocaleString("es-PY")} productos
            </span>
            <span className="mx-2">·</span>
            <span>{totalPares.toLocaleString("es-PY")} pares</span>
          </p>
        </div>
        {hayFiltros && (
          <button
            type="button"
            onClick={() =>
              onChange({
                tipoV2Id: "",
                marcaId: "",
                generoId: "",
                grupoEstiloId: "",
                lineaIds: [],
                colorIds: [],
                q: "",
              })
            }
            className="text-xs font-semibold text-red-700 underline-offset-2 hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        {/* GÉNERO */}
        {filtrosData?.generos && filtrosData.generos.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Género
            </span>
            <Pill active={!filtros.generoId} onClick={() => patch({ generoId: "" })}>
              Todos
            </Pill>
            {filtrosData.generos.map((g) => (
              <Pill
                key={g.id}
                active={filtros.generoId === String(g.id)}
                onClick={() =>
                  patch({ generoId: filtros.generoId === String(g.id) ? "" : String(g.id) })
                }
              >
                {cap(g.label)}
              </Pill>
            ))}
          </div>
        )}

        {/* MARCA */}
        {filtrosData?.marcas && filtrosData.marcas.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Marca
            </span>
            <Pill active={!filtros.marcaId} onClick={() => patch({ marcaId: "" })}>
              Todas
            </Pill>
            {filtrosData.marcas.map((m) => (
              <Pill
                key={m.id}
                active={filtros.marcaId === String(m.id)}
                onClick={() =>
                  patch({ marcaId: filtros.marcaId === String(m.id) ? "" : String(m.id) })
                }
              >
                {cap(m.label)}
              </Pill>
            ))}
          </div>
        )}

        {/* ESTILO */}
        {filtrosData?.estilos && filtrosData.estilos.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Estilo
            </span>
            <Pill active={!filtros.grupoEstiloId} onClick={() => patch({ grupoEstiloId: "" })}>
              Todos
            </Pill>
            {filtrosData.estilos.slice(0, 18).map((e) => (
              <Pill
                key={e.id}
                active={filtros.grupoEstiloId === String(e.id)}
                onClick={() =>
                  patch({ grupoEstiloId: filtros.grupoEstiloId === String(e.id) ? "" : String(e.id) })
                }
              >
                {e.label}
              </Pill>
            ))}
          </div>
        )}

        {/* TIPO V2 - Calzado/Confecciones */}
        {filtrosData?.tipoV2 && filtrosData.tipoV2.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Producto
            </span>
            <Pill active={!filtros.tipoV2Id} onClick={() => patch({ tipoV2Id: "" })}>
              Todos
            </Pill>
            {filtrosData.tipoV2.map((t) => (
              <Pill
                key={t.id}
                active={filtros.tipoV2Id === String(t.id)}
                onClick={() =>
                  patch({ tipoV2Id: filtros.tipoV2Id === String(t.id) ? "" : String(t.id) })
                }
              >
                {t.label}
              </Pill>
            ))}
          </div>
        )}

        {/* Búsqueda */}
        <div className="flex items-center gap-3">
          <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Buscar
          </span>
          <input
            type="search"
            value={filtros.q}
            onChange={(e) => patch({ q: e.target.value })}
            placeholder="Buscar línea, ref, marca, material, color..."
            className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>
    </div>
  );
}
