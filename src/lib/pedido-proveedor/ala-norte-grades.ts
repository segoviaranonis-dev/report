/** Columnas dinámicas de grada — paridad Streamlit `_render_ala_norte`. */
import type { PpAlaNorteRow } from "./ala-norte-types";

export function parseGradesJson(raw: unknown): Record<string, number> {
  if (raw == null) return {};
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw) as unknown;
    } catch {
      return {};
    }
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const n = Number(v);
    if (Number.isFinite(n)) out[String(k).trim()] = n;
  }
  return out;
}

export function tallaSortKey(label: string): number {
  const n = Number(String(label).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 9999;
}

/** Tallas únicas ordenadas numéricamente (20, 21, … 40). */
export function collectGradeColumns(rows: PpAlaNorteRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(parseGradesJson(r.grades_json))) set.add(k);
  }
  return Array.from(set).sort((a, b) => tallaSortKey(a) - tallaSortKey(b));
}

export function gradeQty(row: PpAlaNorteRow, talla: string): number {
  return parseGradesJson(row.grades_json)[talla] ?? 0;
}

/** Pares por caja = inicial / cantidad_cajas (Streamlit «x Caja»). */
export function paresPorCaja(row: PpAlaNorteRow): number | null {
  const cajas = row.cantidad_cajas ?? 0;
  if (cajas <= 0) return null;
  return Math.round(row.cantidad_inicial / cajas);
}
