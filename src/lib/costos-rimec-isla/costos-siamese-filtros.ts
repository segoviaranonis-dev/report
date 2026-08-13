import type { CostosTxtLinea } from "./types";
import {
  cadenaPeFromTipoId,
  peTipoIdFromCadena,
  togglePeTipoDiccionario,
  type PeTipoDiccionarioId,
} from "@/lib/stock-pronta-entrega/filtro-tipo-pe-diccionario";

/** Filtros isla COSTOS — paridad hermanos siameses PE (2.2.1.44 · 2.3.1.10.1.3). */
export type CostosSiameseFiltros = {
  ramo: "" | "CALZADOS" | "CONFECCIONES";
  marcas: string[];
  tipo1: string[];
  tipoPe: PeTipoDiccionarioId[];
  q: string;
  lineas: string[];
  referencias: string[];
  materiales: string[];
  colores: string[];
};

export const EMPTY_COSTOS_SIAMESE: CostosSiameseFiltros = {
  ramo: "",
  marcas: [],
  tipo1: [],
  tipoPe: [],
  q: "",
  lineas: [],
  referencias: [],
  materiales: [],
  colores: [],
};

export { togglePeTipoDiccionario, type PeTipoDiccionarioId };

function cadenaBd(l: CostosTxtLinea): string {
  const c = l.cadena ?? "NORMAL";
  return c === "NORMAL" ? "REGULAR" : c;
}

function normQ(s: string): string {
  return s.trim().toLowerCase();
}

function matchesQ(l: CostosTxtLinea, q: string): boolean {
  const n = normQ(q);
  if (!n) return true;
  const blob = [
    l.codigo,
    l.descripcion,
    l.grupoTexto,
    l.marca,
    l.linea,
    l.referencia,
    l.material,
    l.color,
    l.imagenColorExcel,
    l.grada,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return blob.includes(n);
}

export function applyCostosSiameseFiltros(
  lineas: CostosTxtLinea[],
  f: CostosSiameseFiltros,
): CostosTxtLinea[] {
  const tipoPeSet =
    f.tipoPe.length > 0
      ? new Set(f.tipoPe.map((id) => cadenaPeFromTipoId(id)))
      : null;

  return lineas.filter((l) => {
    if (f.ramo && l.ramo !== f.ramo) return false;
    if (f.marcas.length && (!l.marca || !f.marcas.includes(l.marca))) return false;
    if (f.tipo1.length && (!l.tipo1 || !f.tipo1.includes(l.tipo1))) return false;
    if (tipoPeSet && !tipoPeSet.has(cadenaBd(l))) return false;
    if (!matchesQ(l, f.q)) return false;
    if (f.lineas.length && !f.lineas.includes(l.linea)) return false;
    if (f.referencias.length && !f.referencias.includes(l.referencia)) return false;
    if (f.materiales.length && !f.materiales.includes(l.material)) return false;
    if (f.colores.length && !f.colores.includes(l.color)) return false;
    return true;
  });
}

function uniqSorted(values: string[]): string[] {
  return [...new Set(values.filter((v) => v && v !== "0"))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
}

/** Opciones cascada · dimensión activa restringe molécula (L→R→M→C). */
export function opcionesSiameseCostos(
  lineas: CostosTxtLinea[],
  f: CostosSiameseFiltros,
): {
  marcas: string[];
  tipo1: string[];
  lineas: string[];
  referencias: string[];
  materiales: string[];
  colores: string[];
} {
  const dim = applyCostosSiameseFiltros(lineas, {
    ...f,
    lineas: [],
    referencias: [],
    materiales: [],
    colores: [],
  });

  let mol = dim;
  if (f.lineas.length) mol = mol.filter((l) => f.lineas.includes(l.linea));
  const refsBase = f.lineas.length ? mol : dim;
  if (f.referencias.length) {
    mol = mol.filter((l) => f.referencias.includes(l.referencia));
  }
  const matBase =
    f.lineas.length || f.referencias.length
      ? mol
      : f.referencias.length
        ? refsBase.filter((l) => f.referencias.includes(l.referencia))
        : dim;

  return {
    marcas: uniqSorted(dim.map((l) => l.marca).filter((m): m is string => Boolean(m))),
    tipo1: uniqSorted(dim.map((l) => l.tipo1).filter((t): t is string => Boolean(t))),
    lineas: uniqSorted(dim.map((l) => l.linea)),
    referencias: uniqSorted(
      (f.lineas.length ? mol : dim).map((l) => l.referencia),
    ),
    materiales: uniqSorted(matBase.map((l) => l.material)),
    colores: uniqSorted(
      (f.materiales.length
        ? matBase.filter((l) => f.materiales.includes(l.material))
        : matBase
      ).map((l) => l.color),
    ),
  };
}

export function hayCostosSiameseActivos(f: CostosSiameseFiltros): boolean {
  return JSON.stringify(f) !== JSON.stringify(EMPTY_COSTOS_SIAMESE);
}

export function toggleStrArr(list: string[], val: string): string[] {
  return list.includes(val) ? list.filter((x) => x !== val) : [...list, val];
}

/** Cascada dimensión — limpia molécula al cambiar ramo/marca/tipo. */
export function cascadaDimCostos(
  patch: Partial<CostosSiameseFiltros>,
): Partial<CostosSiameseFiltros> {
  return {
    ...patch,
    lineas: [],
    referencias: [],
    materiales: [],
    colores: [],
  };
}

export function toggleLineaCascadaCostos(
  prev: CostosSiameseFiltros,
  linea: string,
): CostosSiameseFiltros {
  const lineas = toggleStrArr(prev.lineas, linea);
  return { ...prev, lineas, referencias: [], materiales: [], colores: [] };
}

export function toggleReferenciaCascadaCostos(
  prev: CostosSiameseFiltros,
  referencia: string,
): CostosSiameseFiltros {
  const referencias = toggleStrArr(prev.referencias, referencia);
  return { ...prev, referencias, materiales: [], colores: [] };
}

export function toggleMaterialCascadaCostos(
  prev: CostosSiameseFiltros,
  material: string,
): CostosSiameseFiltros {
  const materiales = toggleStrArr(prev.materiales, material);
  return { ...prev, materiales, colores: [] };
}

export function lineaMatchesTipoPe(l: CostosTxtLinea, id: PeTipoDiccionarioId): boolean {
  return cadenaBd(l) === cadenaPeFromTipoId(id);
}

export { peTipoIdFromCadena };
