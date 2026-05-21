"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RetailFilterState } from "@/lib/retail/retail-filters";
import type { RetailFilterItem } from "@/lib/retail/query-filtros";

const RIMEC_BLUE = "#1E40AF";
const RIMEC_CELESTE = "#0EA5E9";

type FiltrosData = {
  generos: RetailFilterItem[];
  marcas: RetailFilterItem[];
  estilos: RetailFilterItem[];
  lineas: RetailFilterItem[];
  tipos: RetailFilterItem[];
  colores: RetailFilterItem[];
};

type Props = {
  filtros: RetailFilterState;
  onChange: (next: RetailFilterState) => void;
  filtrosData: FiltrosData | null;
  totalModelos: number;
  totalPares: number;
  loading?: boolean;
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
          ? "bg-report-navy text-white border-report-navy"
          : "bg-white text-report-ink border-report-rule hover:bg-report-paper2"
      }`}
    >
      {children}
    </button>
  );
}

function DropdownIds({
  label,
  options,
  selectedIds,
  onApply,
}: {
  label: string;
  options: RetailFilterItem[];
  selectedIds: number[];
  onApply: (ids: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState(selectedIds);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setTemp(selectedIds), [selectedIds]);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
          selectedIds.length
            ? "border-report-navy text-report-navy bg-report-paper2"
            : "border-report-rule bg-white text-report-ink hover:bg-report-paper2"
        }`}
      >
        {label}
        {selectedIds.length > 0 ? (
          <span className="rounded-md bg-report-navy/10 px-1.5 py-0.5 text-[10px] text-report-navy font-bold">
            {selectedIds.length}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          className="absolute left-0 top-full z-50 mt-2 max-h-56 w-64 overflow-y-auto rounded-2xl border border-report-rule bg-white p-2 shadow-xl"
        >
          {options.map((o) => {
            const sel = temp.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs ${
                  sel ? "bg-report-paper2 text-report-navy font-semibold" : "text-report-ink hover:bg-report-paper2"
                }`}
                onClick={() =>
                  setTemp((prev) => (prev.includes(o.id) ? prev.filter((x) => x !== o.id) : [...prev, o.id]))
                }
              >
                <span className={`h-3.5 w-3.5 rounded border ${sel ? "border-report-navy bg-report-navy" : "border-report-rule"}`} />
                {o.label}
              </button>
            );
          })}
          <button
            type="button"
            className="mt-2 w-full rounded-lg bg-report-navy py-2 text-xs font-semibold text-white hover:bg-sky-500"
            onClick={() => {
              onApply(temp);
              setOpen(false);
            }}
          >
            Aplicar
          </button>
        </div>
      ) : null}
    </div>
  );
}


export function RetailFiltrosHeader({ filtros, onChange, filtrosData, totalModelos, totalPares, loading }: Props) {
  const patch = useCallback((p: Partial<RetailFilterState>) => onChange({ ...filtros, ...p }), [filtros, onChange]);

  const hayFiltros =
    !!filtros.generoId ||
    !!filtros.marcaId ||
    !!filtros.grupoEstiloId ||
    filtros.lineaIds.length > 0 ||
    filtros.tipoIds.length > 0 ||
    filtros.colorIds.length > 0 ||
    !!filtros.q.trim();

  const estiloLabel = filtrosData?.estilos.find((e) => String(e.id) === filtros.grupoEstiloId)?.label;
  const marcaLabel = filtrosData?.marcas.find((m) => String(m.id) === filtros.marcaId)?.label;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-4 sm:px-6">
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-serif text-xl font-light text-report-navy sm:text-2xl">
            {estiloLabel ? `Estilo ${cap(estiloLabel)}` : marcaLabel ? cap(marcaLabel) : "Stock retail"}
          </h2>
          <p className="mt-1 text-xs text-report-muted">
            <span className="font-semibold text-report-navy2">{totalModelos.toLocaleString("es-PY")} referencias</span>
            <span className="mx-2">·</span>
            <span>{totalPares.toLocaleString("es-PY")} pares (venta en lote)</span>
            {loading ? <span className="ml-2 text-report-muted/50">Actualizando…</span> : null}
          </p>
        </div>
        {hayFiltros ? (
          <button
            type="button"
            onClick={() =>
              onChange({
                generoId: "",
                marcaId: "",
                grupoEstiloId: "",
                lineaIds: [],
                tipoIds: [],
                colorIds: [],
                q: "",
              })
            }
            className="text-xs font-semibold text-red-700 underline-offset-2 hover:underline"
          >
            Limpiar filtros
          </button>
        ) : null}
      </div>

      <div
        className="space-y-4 rounded-2xl border border-report-rule bg-white p-4 shadow-sm"
      >
        {filtrosData?.generos.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-12 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-report-muted">Género</span>
            <Pill active={!filtros.generoId} onClick={() => patch({ generoId: "" })}>
              Todos
            </Pill>
            {filtrosData.generos.map((g) => (
              <Pill
                key={g.id}
                active={filtros.generoId === String(g.id)}
                onClick={() => patch({ generoId: filtros.generoId === String(g.id) ? "" : String(g.id) })}
              >
                {cap(g.label)}
              </Pill>
            ))}
          </div>
        ) : null}

        {filtrosData?.marcas.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-12 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-report-muted">Marca</span>
            <Pill active={!filtros.marcaId} onClick={() => patch({ marcaId: "" })}>
              Todas
            </Pill>
            {filtrosData.marcas.map((m) => (
              <Pill
                key={m.id}
                active={filtros.marcaId === String(m.id)}
                onClick={() => patch({ marcaId: filtros.marcaId === String(m.id) ? "" : String(m.id) })}
              >
                {cap(m.label)}
              </Pill>
            ))}
          </div>
        ) : null}

        {filtrosData?.estilos.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-12 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-report-muted">Estilo</span>
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
        ) : null}

        <div className="h-px bg-report-rule" />

        <div className="flex flex-wrap items-center gap-3">
          {filtrosData ? (
            <>
              <DropdownIds
                label="Línea"
                options={filtrosData.lineas}
                selectedIds={filtros.lineaIds}
                onApply={(lineaIds) => patch({ lineaIds })}
              />
              <DropdownIds
                label="Color"
                options={filtrosData.colores}
                selectedIds={filtros.colorIds}
                onApply={(colorIds) => patch({ colorIds })}
              />
              <DropdownIds
                label="Tipo 1"
                options={filtrosData.tipos}
                selectedIds={filtros.tipoIds}
                onApply={(tipoIds) => patch({ tipoIds })}
              />
            </>
          ) : null}
          <input
            type="search"
            value={filtros.q}
            onChange={(e) => patch({ q: e.target.value })}
            placeholder="Buscar línea, ref, marca…"
            className="min-w-[200px] flex-1 rounded-xl border border-report-rule bg-white px-3 py-2 text-xs text-report-ink placeholder:text-report-muted/70 focus:border-report-navy2 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
