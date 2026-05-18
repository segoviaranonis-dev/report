"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RetailFilterState } from "@/lib/retail/retail-filters";
import type { RetailFilterItem } from "@/lib/retail/query-filtros";

const RIMEC_BLUE = "#1E40AF";
const RIMEC_CELESTE = "#0EA5E9";

type FiltrosData = {
  marcas: RetailFilterItem[];
  estilos: RetailFilterItem[];
  lineas: RetailFilterItem[];
  tipos: RetailFilterItem[];
  colores: string[];
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
          ? "border-sky-400 bg-sky-500/20 text-sky-100"
          : "border-white/15 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10"
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
        className="flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-xs font-semibold transition"
        style={{
          borderColor: selectedIds.length ? RIMEC_CELESTE : "rgba(255,255,255,0.15)",
          color: selectedIds.length ? RIMEC_CELESTE : "rgba(255,255,255,0.65)",
          backgroundColor: selectedIds.length ? "rgba(14,165,233,0.12)" : "rgba(255,255,255,0.04)",
        }}
      >
        {label}
        {selectedIds.length > 0 ? (
          <span className="rounded-md border border-sky-400/30 bg-sky-500/20 px-1.5 py-0.5 text-[10px]">
            {selectedIds.length}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          className="absolute left-0 top-full z-50 mt-2 max-h-56 w-64 overflow-y-auto rounded-2xl border border-white/10 bg-[#12121a] p-2 shadow-xl"
        >
          {options.map((o) => {
            const sel = temp.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs ${
                  sel ? "bg-sky-500/15 text-sky-200" : "text-white/75 hover:bg-white/5"
                }`}
                onClick={() =>
                  setTemp((prev) => (prev.includes(o.id) ? prev.filter((x) => x !== o.id) : [...prev, o.id]))
                }
              >
                <span className={`h-3.5 w-3.5 rounded border ${sel ? "border-sky-400 bg-sky-500" : "border-white/25"}`} />
                {o.label}
              </button>
            );
          })}
          <button
            type="button"
            className="mt-2 w-full rounded-lg bg-sky-600 py-2 text-xs font-semibold text-white hover:bg-sky-500"
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

function DropdownColores({
  colores,
  selected,
  onApply,
}: {
  colores: string[];
  selected: string[];
  onApply: (cols: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState(selected);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setTemp(selected), [selected]);
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
        className="flex items-center gap-2 rounded-xl border-2 border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70"
      >
        Color
        {selected.length > 0 ? (
          <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px]">{selected.length}</span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 max-h-48 w-56 overflow-y-auto rounded-2xl border border-white/10 bg-[#12121a] p-2 shadow-xl">
          {colores.map((c) => {
            const sel = temp.includes(c);
            return (
              <button
                key={c}
                type="button"
                className={`block w-full rounded-lg px-3 py-2 text-left text-xs ${sel ? "bg-sky-500/15 text-sky-200" : "text-white/75 hover:bg-white/5"}`}
                onClick={() => setTemp((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]))}
              >
                {c}
              </button>
            );
          })}
          <button
            type="button"
            className="mt-2 w-full rounded-lg bg-sky-600 py-2 text-xs font-semibold text-white"
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
    !!filtros.marcaId ||
    !!filtros.grupoEstiloId ||
    filtros.lineaIds.length > 0 ||
    filtros.tipoIds.length > 0 ||
    filtros.colores.length > 0 ||
    !!filtros.q.trim();

  const estiloLabel = filtrosData?.estilos.find((e) => String(e.id) === filtros.grupoEstiloId)?.label;
  const marcaLabel = filtrosData?.marcas.find((m) => String(m.id) === filtros.marcaId)?.label;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-4 sm:px-6">
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-serif text-xl font-light text-white sm:text-2xl">
            {estiloLabel ? `Estilo ${cap(estiloLabel)}` : marcaLabel ? cap(marcaLabel) : "Stock retail"}
          </h2>
          <p className="mt-1 text-xs text-white/45">
            <span style={{ color: RIMEC_CELESTE }}>{totalModelos.toLocaleString("es-PY")} referencias</span>
            <span className="mx-2">·</span>
            <span>{totalPares.toLocaleString("es-PY")} pares (venta en lote)</span>
            {loading ? <span className="ml-2 text-white/30">Actualizando…</span> : null}
          </p>
        </div>
        {hayFiltros ? (
          <button
            type="button"
            onClick={() =>
              onChange({
                marcaId: "",
                grupoEstiloId: "",
                lineaIds: [],
                tipoIds: [],
                colores: [],
                q: "",
              })
            }
            className="text-xs font-semibold text-red-300/90 underline-offset-2 hover:underline"
          >
            Limpiar filtros
          </button>
        ) : null}
      </div>

      <div
        className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
        style={{ boxShadow: "0 2px 16px rgba(30,64,175,0.12)" }}
      >
        {filtrosData?.marcas.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-12 shrink-0 text-[10px] font-bold uppercase tracking-widest text-white/40">Marca</span>
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
            <span className="w-12 shrink-0 text-[10px] font-bold uppercase tracking-widest text-white/40">Estilo</span>
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

        <div className="h-px bg-white/10" />

        <div className="flex flex-wrap items-center gap-3">
          {filtrosData ? (
            <>
              <DropdownIds
                label="Línea"
                options={filtrosData.lineas}
                selectedIds={filtros.lineaIds}
                onApply={(lineaIds) => patch({ lineaIds })}
              />
              <DropdownColores
                colores={filtrosData.colores}
                selected={filtros.colores}
                onApply={(colores) => patch({ colores })}
              />
              <DropdownIds
                label="Tipo"
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
            className="min-w-[200px] flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/35 focus:border-sky-500/50 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
