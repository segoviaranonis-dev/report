import type { ReposicionArticulo } from "@/lib/herramienta-reposicion/merge-reposicion";
import {
  compareReposicionPorNivel,
  type NivelAmMap,
} from "@/lib/herramienta-reposicion/nivel-am";
import { enteroPares } from "@/lib/herramienta-reposicion/totales-reposicion";

/** Modo de ordenamiento Director · KPI encendido */
export type OrdenReposicionModo =
  | "peDisponible"
  | "cpDisponible"
  | "cpVendido"
  | "programado"
  | "nivelAm";

export const ORDEN_STOCK_PE: OrdenReposicionModo = "peDisponible";
export const ORDEN_TRANSITO_CP: OrdenReposicionModo = "cpDisponible";
export const ORDEN_COMPRA_PREVIA: OrdenReposicionModo = "cpVendido";
export const ORDEN_PROGRAMADO: OrdenReposicionModo = "programado";

export type OrdenReposicionMetric = Exclude<OrdenReposicionModo, "nivelAm">;

export function esOrdenPorMetrica(modo: OrdenReposicionModo): modo is OrdenReposicionMetric {
  return modo !== "nivelAm";
}

export function metricaOrden(a: ReposicionArticulo, modo: OrdenReposicionModo): number {
  if (modo === "peDisponible") return enteroPares(a.totales.peDisponible);
  if (modo === "cpDisponible") return enteroPares(a.totales.cpDisponible);
  if (modo === "cpVendido") return enteroPares(a.totales.cpVendido);
  if (modo === "programado") return enteroPares(a.totales.programado);
  return 0;
}

/**
 * Orden por KPI (PE / CP disp / CP vendido / Programado) DESC.
 * Desempate: nivel AM · marca · L+R.
 */
export function compareReposicionPorOrden(
  a: ReposicionArticulo,
  b: ReposicionArticulo,
  modo: OrdenReposicionModo,
  niveles: NivelAmMap,
): number {
  if (modo === "nivelAm") {
    return compareReposicionPorNivel(a, b, niveles);
  }
  const da = metricaOrden(a, modo);
  const db = metricaOrden(b, modo);
  if (db !== da) return db - da;
  return compareReposicionPorNivel(a, b, niveles);
}

export function ordenarArticulosReposicion(
  list: ReposicionArticulo[],
  modo: OrdenReposicionModo,
  niveles: NivelAmMap,
): ReposicionArticulo[] {
  return [...list].sort((a, b) => compareReposicionPorOrden(a, b, modo, niveles));
}

/** Rank 1-based en la lista ya ordenada (#1 = mayor métrica). */
export function ranksOrdenReposicion(
  ordenados: ReposicionArticulo[],
): Map<string, number> {
  const map = new Map<string, number>();
  ordenados.forEach((a, i) => map.set(a.key, i + 1));
  return map;
}

/** Σ métrica enteros · tolerancia 0 (transferencia bancaria). */
export function sumaMetricaOrden(
  list: ReposicionArticulo[],
  modo: OrdenReposicionMetric,
): number {
  let s = 0;
  for (const a of list) s += metricaOrden(a, modo);
  return s;
}

export function etiquetaOrdenModo(modo: OrdenReposicionModo): string {
  switch (modo) {
    case "peDisponible":
      return "Ordenamiento por En stock (PE) · chips #1…#n · Σ PE de la grilla = KPI En stock (PE)";
    case "cpDisponible":
      return "Ordenamiento por En tránsito (CP disp.) · chips #1…#n · Σ CP disp. = KPI En tránsito";
    case "cpVendido":
      return "Ordenamiento por compra previa · chips #1…#n · Σ CP vendido = KPI Vendido (CP)";
    case "programado":
      return "Ordenamiento por programado · chips #1…#n · Σ programado = KPI Programado";
    default:
      return "Orden por niveles AM";
  }
}
