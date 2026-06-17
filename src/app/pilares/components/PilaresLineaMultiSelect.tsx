"use client";

import { useState } from "react";
import type { TipoV2Id } from "@/lib/pilares/types";
import { PilaresLineaSearchInput } from "./PilaresLineaSearchInput";

interface Props {
  tipoV2Id: TipoV2Id;
  selected: string[];
  onChange: (codes: string[]) => void;
  scopeTotal?: number;
}

export function PilaresLineaMultiSelect({ tipoV2Id, selected, onChange, scopeTotal }: Props) {
  const [draft, setDraft] = useState("");

  const addCode = (raw: string) => {
    const code = raw.trim();
    if (!code || selected.includes(code)) {
      setDraft("");
      return;
    }
    onChange([...selected, code].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
    setDraft("");
  };

  const removeCode = (code: string) => {
    onChange(selected.filter((c) => c !== code));
  };

  return (
    <div className="sm:col-span-2 lg:col-span-5">
      <PilaresLineaSearchInput
        tipoV2Id={tipoV2Id}
        label="Líneas (multi-selección)"
        value={draft}
        onChange={setDraft}
        onPick={addCode}
        placeholder="Buscar y elegir…"
      />
      <div className="mt-2">
        {selected.length ? (
          <div className="flex flex-wrap gap-2">
            {selected.map((code) => (
              <span
                key={code}
                className="inline-flex items-center gap-1 rounded-full border border-rimec-azul/30 bg-rimec-celeste-bg/50 px-3 py-1 font-mono text-sm"
              >
                {code}
                <button
                  type="button"
                  aria-label={`Quitar línea ${code}`}
                  onClick={() => removeCode(code)}
                  className="ml-0.5 rounded-full px-1 text-rimec-azul hover:bg-white"
                >
                  ×
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => onChange([])}
              className="rounded-full px-2 py-1 text-xs font-semibold text-neutral-500 hover:bg-neutral-100"
            >
              Limpiar todas
            </button>
          </div>
        ) : (
          <p className="text-xs text-neutral-600">
            Sin líneas elegidas → el editor aplica sobre{" "}
            <strong>{scopeTotal != null ? scopeTotal.toLocaleString("es-PY") : "…"}</strong> filas del
            filtro actual (marca · estilo · tipo 1).
          </p>
        )}
      </div>
    </div>
  );
}
