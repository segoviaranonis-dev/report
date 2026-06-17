"use client";

import type { TipoV2Id } from "@/lib/pilares/types";
import { PilaresLineaMultiSelect } from "./PilaresLineaMultiSelect";

interface LineaReferenciaBuscadorProps {
  tipoV2Id: TipoV2Id;
  lineasSeleccionadas: string[];
  onLineasChange: (codes: string[]) => void;
  scopeTotal?: number;
}

export function LineaReferenciaBuscador({
  tipoV2Id,
  lineasSeleccionadas,
  onLineasChange,
  scopeTotal,
}: LineaReferenciaBuscadorProps) {
  return (
    <div className="mb-4 rounded-2xl border-2 border-rimec-azul/20 bg-white p-4 shadow-sm">
      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-rimec-azul">
        Buscador de líneas
      </p>
      <p className="mb-4 text-xs text-neutral-600">
        Elegí una o varias líneas para filtrar la grilla. Sin «hasta» — solo multi-selección.
      </p>
      <PilaresLineaMultiSelect
        tipoV2Id={tipoV2Id}
        selected={lineasSeleccionadas}
        onChange={onLineasChange}
        scopeTotal={scopeTotal}
      />
    </div>
  );
}
