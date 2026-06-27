"use client";

import { useEffect, useState } from "react";
import type { CantidadOp, OperativaFilterState } from "@/lib/depositos/operativa-filters";

export type CantidadDraft = Pick<OperativaFilterState, "cantidadOp" | "cantidadValor">;

type Props = {
  applied: CantidadDraft;
  onApply: (draft: CantidadDraft) => void;
  onClear: () => void;
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
          ? "border-rimec-azul bg-rimec-azul text-white"
          : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

function resumenCantidad(applied: CantidadDraft): string | null {
  if (!applied.cantidadOp || applied.cantidadValor == null) return null;
  const op = applied.cantidadOp === "gt" ? "Mayor que" : "Menor que";
  return `${op} ${applied.cantidadValor.toLocaleString("es-PY")} pares totales`;
}

export function FiltroCantidadOperativa({ applied, onApply, onClear }: Props) {
  const [draft, setDraft] = useState<CantidadDraft>(applied);

  useEffect(() => {
    setDraft(applied);
  }, [applied]);

  const pendiente =
    draft.cantidadOp !== applied.cantidadOp || draft.cantidadValor !== applied.cantidadValor;

  const cantidadIncompleta =
    draft.cantidadOp != null && (draft.cantidadValor == null || draft.cantidadValor < 0);
  const puedeAplicar = pendiente && !cantidadIncompleta;

  const activo = applied.cantidadOp != null && applied.cantidadValor != null;
  const resumen = resumenCantidad(applied);

  const handleApply = () => {
    if (!puedeAplicar) return;
    onApply(draft);
  };

  const setCantidadOp = (op: CantidadOp) => {
    if (draft.cantidadOp === op) {
      setDraft({ cantidadOp: null, cantidadValor: null });
      return;
    }
    setDraft({
      cantidadOp: op,
      cantidadValor: draft.cantidadValor ?? 10,
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-4">
      <details
        open={activo || pendiente}
        className="rounded-2xl border border-rimec-azul/25 bg-gradient-to-b from-white to-slate-50 shadow-sm ring-1 ring-rimec-azul/10"
      >
        <summary className="cursor-pointer list-none px-4 py-3 [&::-webkit-details-marker]:hidden">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-sm text-rimec-azul" aria-hidden>
                ▾
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-rimec-azul">
                  Análisis por cantidad
                </p>
                <p className="text-sm text-gray-600">
                  {resumen ?? "Independiente · pares totales por producto"}
                </p>
              </div>
            </div>
            {activo && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onClear();
                }}
                className="min-h-[44px] shrink-0 rounded-xl border border-red-200 bg-white px-4 text-xs font-semibold text-red-700"
              >
                Quitar filtro cantidad
              </button>
            )}
          </div>
        </summary>

        <div className="space-y-3 border-t border-rimec-azul/10 px-4 pb-4 pt-3">
          <p className="text-center text-xs text-gray-500">
            Filtra moléculas por pares totales en stock (todas las gradas sumadas).
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Pill active={draft.cantidadOp === "gt"} onClick={() => setCantidadOp("gt")}>
              Mayor que
            </Pill>
            <Pill active={draft.cantidadOp === "lt"} onClick={() => setCantidadOp("lt")}>
              Menor que
            </Pill>
            {draft.cantidadOp && (
              <input
                type="number"
                min={0}
                step={1}
                value={draft.cantidadValor ?? ""}
                onChange={(e) => {
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  setDraft({
                    ...draft,
                    cantidadValor: v != null && Number.isFinite(v) ? v : null,
                  });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleApply();
                }}
                className="w-24 rounded-lg border border-gray-300 bg-white px-2 py-2 text-center text-sm font-semibold text-gray-800 focus:border-rimec-azul focus:outline-none"
                aria-label="Valor pares"
              />
            )}
            {draft.cantidadOp && (
              <span className="text-xs font-medium text-gray-600">pares totales</span>
            )}
          </div>
          {pendiente && (
            <p className="text-center text-[10px] font-medium text-amber-700">Cambios sin aplicar</p>
          )}
          <div className="flex justify-center">
            <button
              type="button"
              disabled={!puedeAplicar}
              onClick={handleApply}
              className={`min-h-[48px] min-w-[200px] rounded-xl px-8 text-sm font-bold text-white shadow-md transition ${
                puedeAplicar
                  ? "bg-rimec-azul hover:bg-rimec-azul-dark active:scale-[0.98]"
                  : "cursor-not-allowed bg-gray-300 text-gray-500"
              }`}
            >
              Aplicar filtro cantidad
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}
