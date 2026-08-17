"use client";

import type { DepositoFilterItem } from "@/app/api/depositos/[cliente_id]/filtros/route";
import { toggleOperativaId } from "@/lib/depositos/operativa-filters";

type Props = {
  label: string;
  items: DepositoFilterItem[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  /** Chip «sin asignar» (id sintético o filtro paralelo). */
  sinAsignar?: boolean;
  onSinAsignarChange?: (v: boolean) => void;
  emptyHint?: string;
};

/**
 * Barra multi-chip horizontal (hermana visual de FiltroTonoOperativa) — Estilo / Tipo 1.
 */
export function PeFiltroChipsMulti({
  label,
  items,
  selectedIds,
  onChange,
  sinAsignar = false,
  onSinAsignarChange,
  emptyHint = "Sin opciones en el universo filtrado",
}: Props) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <span className="w-14 shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            onChange([]);
            onSinAsignarChange?.(false);
          }}
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
            !sinAsignar && selectedIds.length === 0
              ? "border-bazzar-naranja bg-bazzar-naranja text-white"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          Todos
        </button>
        {onSinAsignarChange ? (
          <button
            type="button"
            onClick={() => {
              onSinAsignarChange(!sinAsignar);
              onChange([]);
            }}
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
              sinAsignar
                ? "border-amber-500 bg-amber-500 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Sin asignar
          </button>
        ) : null}
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-0.5">
          {items.length === 0 ? (
            <span className="text-[10px] text-slate-400">{emptyHint}</span>
          ) : (
            items.map((it) => {
              const on = selectedIds.includes(it.id);
              return (
                <button
                  key={it.id}
                  type="button"
                  title={it.label}
                  onClick={() => {
                    onSinAsignarChange?.(false);
                    onChange(toggleOperativaId(selectedIds, it.id));
                  }}
                  className={`max-w-[9rem] shrink-0 truncate rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                    on
                      ? "border-rimec-azul bg-rimec-azul text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-rimec-azul/40"
                  }`}
                >
                  {it.label}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
