/**
 * Ley grada Carlos — 2.3.1.7.5.3.16 · LEY_GRADA_CEROS_CARLOS_PROFORMA.md
 * Entre talla min y max del pedido, cada entero del rango tiene cantidad; falta = 0.
 * Ejemplo: {35:1, 37:5, 38:4, 39:2} → 35(1 0 5 4 2)39
 * BD grades_json puede ser sparse; serialización Carlos/UI/CSV expande ceros.
 */
import { gradesJsonSoloTallas, isGradesTallaKey } from "./grades-json-canonical";

function tallaEntera(key: string): number {
  const head = (String(key).split("/")[0] ?? key).replace(/[^\d.]/g, "");
  const n = Number(head);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

function sortTallaKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => tallaEntera(a) - tallaEntera(b));
}

/** Expande sparse min→max con qty 0 en tallas faltantes (solo enteros calzado). */
export function expandGradesJsonCarlos(
  grades: Record<string, number> | null | undefined,
): Record<string, number> {
  if (!grades || typeof grades !== "object") return {};
  const keys = Object.keys(grades).filter(isGradesTallaKey);
  if (keys.length === 0) return {};

  const sorted = sortTallaKeys(keys);
  const min = tallaEntera(sorted[0]!);
  const max = tallaEntera(sorted[sorted.length - 1]!);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return {};

  const byInt = new Map<number, number>();
  for (const k of sorted) {
    const t = tallaEntera(k);
    if (Number.isFinite(t)) byInt.set(t, Math.round(Number(grades[k]) || 0));
  }

  const out: Record<string, number> = {};
  for (let t = min; t <= max; t++) {
    out[String(t)] = byInt.get(t) ?? 0;
  }
  return out;
}

/**
 * grades_json → formato Carlos: 35(1 0 5 4 2)39
 * Separador espacio dentro del paréntesis (ley importadora).
 */
export function gradasFmtCarlosFromJson(
  grades: Record<string, number> | null | undefined,
): string {
  const expanded = expandGradesJsonCarlos(grades);
  const keys = sortTallaKeys(Object.keys(expanded));
  if (keys.length === 0) return "";
  const cantidades = keys.map((k) => String(Math.round(Number(expanded[k]) || 0)));
  return `${keys[0]}(${cantidades.join(" ")})${keys[keys.length - 1]}`;
}

/** Desde raw JSONB PPD (incluye metadata _shop). */
export function gradasFmtCarlosFromRaw(raw: unknown): string {
  return gradasFmtCarlosFromJson(gradesJsonSoloTallas(raw));
}
