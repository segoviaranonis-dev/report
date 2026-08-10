/**
 * Cascada Dimensión → Molécula L→R→M→C (paridad 2.2.1.42 / 2.2.1.44 · siamese Web).
 * Depósito Web · Stock PE · AM — limpia selecciones aguas abajo.
 */
import type { OperativaFilterState } from "@/lib/depositos/operativa-filters";
import { toggleOperativaId } from "@/lib/depositos/operativa-filters";
import { toggleFamiliaKey } from "@/lib/pilares/agrupar-etiqueta-pilar";

export type CascadaOpPatch = Partial<OperativaFilterState>;

/** Dimensión (AB-CR · Marca · Tipo · Género) → limpia molécula Estilo→L→R→M→C. */
export function cascadaDimensionesOperativa(patch: CascadaOpPatch = {}): CascadaOpPatch {
  return {
    ...patch,
    grupoEstiloIds: [],
    lineaIds: [],
    referenciaIds: [],
    materialFamilias: [],
    colorFamilias: [],
  };
}

export function cascadaEstiloOperativa(grupoEstiloIds: number[]): CascadaOpPatch {
  return {
    grupoEstiloIds,
    lineaIds: [],
    referenciaIds: [],
    materialFamilias: [],
    colorFamilias: [],
  };
}

/** Línea → limpia Referencia + Material + Color. */
export function cascadaLineaOperativa(lineaIds: number[]): CascadaOpPatch {
  return { lineaIds, referenciaIds: [], materialFamilias: [], colorFamilias: [] };
}

/** Referencia → limpia Material + Color. */
export function cascadaReferenciaOperativa(referenciaIds: number[]): CascadaOpPatch {
  return { referenciaIds, materialFamilias: [], colorFamilias: [] };
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

export function toggleReferenciaCascadaOp(actual: number[], id: number): CascadaOpPatch {
  return cascadaReferenciaOperativa(toggleOperativaId(actual, id));
}

export function toggleMaterialCascadaOp(actual: string[], key: string): CascadaOpPatch {
  return cascadaMaterialOperativa(toggleFamiliaKey(actual, key));
}
