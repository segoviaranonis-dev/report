/**
 * Cascada Dimensión → Molécula (paridad 2.2.1.42 / 2.2.1.44).
 * Depósito Web · Stock PE · AM — limpia selecciones aguas abajo.
 */
import type { OperativaFilterState } from "@/lib/depositos/operativa-filters";
import { toggleOperativaId } from "@/lib/depositos/operativa-filters";
import { toggleFamiliaKey } from "@/lib/pilares/agrupar-etiqueta-pilar";

export type CascadaOpPatch = Partial<OperativaFilterState>;

/** Dimensión (AB-CR · Marca · Tipo · Género) → limpia molécula Estilo→Color. */
export function cascadaDimensionesOperativa(patch: CascadaOpPatch = {}): CascadaOpPatch {
  return {
    ...patch,
    grupoEstiloIds: [],
    lineaIds: [],
    materialFamilias: [],
    colorFamilias: [],
  };
}

export function cascadaEstiloOperativa(grupoEstiloIds: number[]): CascadaOpPatch {
  return {
    grupoEstiloIds,
    lineaIds: [],
    materialFamilias: [],
    colorFamilias: [],
  };
}

export function cascadaLineaOperativa(lineaIds: number[]): CascadaOpPatch {
  return { lineaIds, materialFamilias: [], colorFamilias: [] };
}

export function cascadaMaterialOperativa(materialFamilias: string[]): CascadaOpPatch {
  return { materialFamilias, colorFamilias: [] };
}

export function toggleEstiloCascadaOp(actual: number[], id: number): CascadaOpPatch {
  return cascadaEstiloOperativa(toggleOperativaId(actual, id));
}

export function toggleLineaCascadaOp(actual: number[], id: number): CascadaOpPatch {
  return cascadaLineaOperativa(toggleOperativaId(actual, id));
}

export function toggleMaterialCascadaOp(actual: string[], key: string): CascadaOpPatch {
  return cascadaMaterialOperativa(toggleFamiliaKey(actual, key));
}
