import { CATEGORIA_VENTA_CALZADOS_IDS } from "./constants";
import type { CascadaDominios } from "./encajar-filtros-cascada";

export function catIdNum(id: number | string): number {
  return Number(id);
}

export function catIdEq(a: number | string, b: number | string): boolean {
  const na = Number(a);
  const nb = Number(b);
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
}

export function normCatIds(ids: number[]): number[] {
  return [...new Set(ids.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
}

export function catIdsInclude(selected: number[], id: number | string): boolean {
  const n = Number(id);
  return selected.some((x) => Number(x) === n);
}

/** Cascada API puede devolver ids string — normalizar una vez al recibir snapshot. */
export function normalizeCascadaCategorias(
  categorias: { id_categoria: number; nombre: string }[],
): { id_categoria: number; nombre: string }[] {
  return categorias.map((c) => ({
    id_categoria: Number(c.id_categoria),
    nombre: String(c.nombre ?? "").trim() || `#${c.id_categoria}`,
  }));
}

/**
 * IDs válidos en cascada. Si el estado trae constantes legacy 1-2-3 sin match en BD,
 * remapea al default real de la cascada (primer sync).
 */
export function resolveCategoriaIdsUi(
  selected: number[],
  cascada: Pick<CascadaDominios, "categorias">,
): number[] {
  const cats = normalizeCascadaCategorias(cascada.categorias);
  const catSet = new Set(cats.map((c) => c.id_categoria));
  const raw = normCatIds(selected);
  const valid = raw.filter((id) => catSet.has(id));
  if (valid.length) return valid;

  const isLegacyDefault =
    raw.length === CATEGORIA_VENTA_CALZADOS_IDS.length &&
    raw.every((id) => (CATEGORIA_VENTA_CALZADOS_IDS as readonly number[]).includes(id));

  if (isLegacyDefault && cats.length) {
    return cats.map((c) => c.id_categoria);
  }
  return raw;
}
