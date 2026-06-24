import type { Pool } from "pg";

/**
 * Palabra reservada holding — ver Moria FECHA_DE_EMBARQUE.md
 * UI Streamlit legacy: label «Llegada». En Report: «FECHA DE EMBARQUE».
 */
export const FECHA_DE_EMBARQUE_LABEL = "FECHA DE EMBARQUE" as const;

/** Columna BD canónica para la FECHA DE EMBARQUE */
export const FECHA_DE_EMBARQUE_CAMPO = "quincena_arribo_id" as const;

/** Catálogo maestro MIG-096 — fallback si BD no responde */
export const QUINCENA_ARRIBO_CATALOGO: Record<number, string> = {
  1: "1ra Quincena de Enero",
  2: "2da Quincena de Enero",
  3: "1ra Quincena de Febrero",
  4: "2da Quincena de Febrero",
  5: "1ra Quincena de Marzo",
  6: "2da Quincena de Marzo",
  7: "1ra Quincena de Abril",
  8: "2da Quincena de Abril",
  9: "1ra Quincena de Mayo",
  10: "2da Quincena de Mayo",
  11: "1ra Quincena de Junio",
  12: "2da Quincena de Junio",
  13: "1ra Quincena de Julio",
  14: "2da Quincena de Julio",
  15: "1ra Quincena de Agosto",
  16: "2da Quincena de Agosto",
  17: "1ra Quincena de Septiembre",
  18: "2da Quincena de Septiembre",
  19: "1ra Quincena de Octubre",
  20: "2da Quincena de Octubre",
  21: "1ra Quincena de Noviembre",
  22: "2da Quincena de Noviembre",
  23: "1ra Quincena de Diciembre",
  24: "2da Quincena de Diciembre",
};

export type QuincenaArribo = { id: number; descripcion: string };

export function quincenaSliderValue(raw: number | null | undefined): number {
  if (raw == null || raw <= 0) return 0;
  return Math.min(24, Math.max(1, Math.trunc(raw)));
}

export function quincenaDbValue(slider: number): number | null {
  return slider > 0 ? slider : null;
}

export function descripcionFechaEmbarque(
  quincenaId: number | null | undefined,
  lookup: Record<number, string>,
): string {
  const v = quincenaSliderValue(quincenaId);
  if (v === 0) return "Sin definir";
  return lookup[v] ?? QUINCENA_ARRIBO_CATALOGO[v] ?? `Quincena ${v}`;
}

export async function loadQuincenasArribo(pool: Pool): Promise<QuincenaArribo[]> {
  try {
    const { rows } = await pool.query<{ id: string; descripcion: string }>(
      "SELECT id, descripcion FROM quincena_arribo ORDER BY id",
    );
    if (rows.length === 0) {
      return Object.entries(QUINCENA_ARRIBO_CATALOGO).map(([id, descripcion]) => ({
        id: Number(id),
        descripcion,
      }));
    }
    return rows.map((r) => ({ id: Number(r.id), descripcion: r.descripcion }));
  } catch {
    return Object.entries(QUINCENA_ARRIBO_CATALOGO).map(([id, descripcion]) => ({
      id: Number(id),
      descripcion,
    }));
  }
}

export function quincenasToLookup(list: QuincenaArribo[]): Record<number, string> {
  return Object.fromEntries(list.map((q) => [q.id, q.descripcion]));
}
