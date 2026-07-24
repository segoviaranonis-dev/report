import { defaultCalzadosCategoriaIds, MESES_LISTA } from "./constants";
import type { SalesReportFilters } from "./types";

export type CascadaDominios = {
  departamentos: string[];
  categorias: { id_categoria: number; nombre: string }[];
  meses_nombres: string[];
  marcas: string[];
  cadenas: string[];
  vendedores: string[];
};

function sameNumArray(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

function sameStrArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

function normCatIds(ids: number[]): number[] {
  return [...new Set(ids.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
}

/**
 * Ajusta filtros al dominio cascada devuelto por el servidor.
 *
 * Reglas (Sales Report · paridad Streamlit):
 * - **Nunca** expandir categorías al default calzados si el usuario ya eligió ≥1 id.
 * - Default calzados solo cuando `categoria_ids` viene vacío (estado inicial).
 * - Marcas/cadenas/vendedores vacíos = «sin filtro» (= todos en SQL) — no rellenar.
 * - Meses: conservar intersección; default 6 solo si el usuario no tenía meses.
 */
export function encajarFiltrosCascada(
  f: SalesReportFilters,
  c: CascadaDominios,
): SalesReportFilters {
  const dep = f.departamento.trim().toUpperCase();
  const depOk = c.departamentos.some((x) => x.trim().toUpperCase() === dep);
  const departamento = depOk ? f.departamento : (c.departamentos[0] ?? f.departamento);

  const catSet = new Set(c.categorias.map((x) => Number(x.id_categoria)));
  const catFiltered = normCatIds(f.categoria_ids).filter((id) => catSet.has(id));
  const calzadosDefault = defaultCalzadosCategoriaIds(c.categorias);

  let categoria_ids: number[];
  if (c.categorias.length === 0) {
    categoria_ids = f.categoria_ids.length ? f.categoria_ids : calzadosDefault;
  } else if (catFiltered.length > 0) {
    categoria_ids = catFiltered;
  } else if (f.categoria_ids.length === 0) {
    categoria_ids = calzadosDefault;
  } else {
    // Selección explícita pero ids fuera del dominio — no inflar a las 3
    categoria_ids = [];
  }

  const monthPool = c.meses_nombres.length > 0 ? c.meses_nombres : MESES_LISTA;
  const mesFiltered = f.meses.filter((m) => monthPool.includes(m));
  let meses: string[];
  if (mesFiltered.length > 0) {
    meses = mesFiltered;
  } else if (f.meses.length === 0) {
    meses = monthPool.slice(0, Math.min(6, monthPool.length));
  } else {
    meses = f.meses;
  }

  const marcas = f.marcas.filter((x) => c.marcas.includes(x));
  const cadenas = f.cadenas.filter((x) => c.cadenas.includes(x));
  const vendedores = f.vendedores.filter((x) => c.vendedores.includes(x));

  const next: SalesReportFilters = {
    ...f,
    departamento,
    categoria_ids,
    meses: meses.length ? meses : f.meses,
    marcas,
    cadenas,
    vendedores,
  };

  if (
    next.departamento === f.departamento &&
    sameNumArray(next.categoria_ids, f.categoria_ids) &&
    sameStrArray(next.meses, f.meses) &&
    sameStrArray(next.marcas, f.marcas) &&
    sameStrArray(next.cadenas, f.cadenas) &&
    sameStrArray(next.vendedores, f.vendedores)
  ) {
    return f;
  }

  return next;
}

/**
 * Tras Sincronizar manual: encaja dominios pero **nunca** toca categorías elegidas.
 */
export function encajarFiltrosTrasSyncUsuario(
  f: SalesReportFilters,
  c: CascadaDominios,
): SalesReportFilters {
  const catsUsuario = normCatIds(f.categoria_ids);
  const encajado = encajarFiltrosCascada(f, c);
  if (catsUsuario.length === 0) return encajado;
  if (sameNumArray(encajado.categoria_ids, catsUsuario)) return encajado;
  return { ...encajado, categoria_ids: catsUsuario };
}

export function encajeAlteroSeleccion(prev: SalesReportFilters, next: SalesReportFilters): boolean {
  const sameCats = sameNumArray(prev.categoria_ids, next.categoria_ids);
  const sameMeses = sameStrArray(prev.meses, next.meses);
  const sameMarcas = sameStrArray(prev.marcas, next.marcas);
  const sameCadenas = sameStrArray(prev.cadenas, next.cadenas);
  const sameVend = sameStrArray(prev.vendedores, next.vendedores);
  return !(sameCats && sameMeses && sameMarcas && sameCadenas && sameVend && prev.departamento === next.departamento);
}
