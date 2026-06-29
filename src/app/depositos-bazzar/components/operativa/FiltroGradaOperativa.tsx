"use client";

import { useEffect, useState } from "react";
import type { OperativaFilterState } from "@/lib/depositos/operativa-filters";

export type GradaDraft = Pick<OperativaFilterState, "gradas">;

type Props = {
  applied: GradaDraft;
  gradasOpciones: string[];
  onApply: (draft: GradaDraft) => void;
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

export function FiltroGradaOperativa({ applied, gradasOpciones, onApply }: Props) {
  const [draft, setDraft] = useState<GradaDraft>(applied);

  useEffect(() => {
    setDraft(applied);
  }, [applied]);

  const pendiente =
    draft.gradas.length !== applied.gradas.length ||
    [...draft.gradas].sort().join() !== [...applied.gradas].sort().join();

  const toggleGrada = (g: string) => {
    setDraft((prev) => ({
      gradas: prev.gradas.includes(g)
        ? prev.gradas.filter((x) => x !== g)
        : [...prev.gradas, g],
    }));
  };

  if (gradasOpciones.length === 0) return null;

  return (
    <div className="rounded-xl border border-dashed border-bazzar-naranja/40 bg-orange-50/40 px-3 py-3">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-bazzar-naranja">Grada</p>
          {pendiente && (
            <p className="mt-0.5 text-[10px] font-medium text-amber-700">Cambios sin aplicar</p>
          )}
          {applied.gradas.length > 0 && !pendiente && (
            <p className="mt-0.5 text-[10px] font-medium text-gray-600">
              Activo: {applied.gradas.join(", ")}
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={!pendiente}
          onClick={() => onApply(draft)}
          className={`min-h-[44px] shrink-0 rounded-xl px-6 text-sm font-bold text-white shadow-sm transition ${
            pendiente
              ? "bg-bazzar-naranja hover:bg-bazzar-naranja-dark"
              : "cursor-not-allowed bg-gray-300 text-gray-500"
          }`}
        >
          Aplicar grada
        </button>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5 sm:justify-start">
        <Pill active={draft.gradas.length === 0} onClick={() => setDraft({ gradas: [] })}>
          Todas
        </Pill>
        {gradasOpciones.map((g) => (
          <Pill key={g} active={draft.gradas.includes(g)} onClick={() => toggleGrada(g)}>
            {g}
          </Pill>
        ))}
      </div>
    </div>
  );
}
