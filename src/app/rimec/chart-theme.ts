import type { CSSProperties } from "react";

/** Orden visual global: año menor (izq) → objetivo (centro) → real actual (der). */
export const COLOR_REAL_ANTERIOR = "#002B4E"; // RIMEC NIIF
export const COLOR_OBJETIVO = "#94A3B8";
export const COLOR_REAL_ACTUAL = "#22C55E"; // Verde NIIF actual

export const PIE_CALZADO = "#002B4E";
export const PIE_CONFECCION = "#22C55E";

/** Paleta cíclica para series múltiples (marcas, segmentos, pilares). Política de gráficos, no institucional. */
export const CHART_PALETTE_CYCLE = [
  COLOR_REAL_ANTERIOR,
  COLOR_REAL_ACTUAL,
  COLOR_OBJETIVO,
] as const;

export function chartColorAt(index: number): string {
  return CHART_PALETTE_CYCLE[index % CHART_PALETTE_CYCLE.length];
}

/** Props comunes de `<Tooltip />` (Recharts): tema claro NIIF. */
export const RIMEC_RECHARTS_TOOLTIP: {
  contentStyle: CSSProperties;
  labelStyle: CSSProperties;
  itemStyle?: CSSProperties;
} = {
  contentStyle: {
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    color: "#2d2520",
  },
  labelStyle: { color: "#002B4E", fontWeight: 600, marginBottom: 4 },
};
