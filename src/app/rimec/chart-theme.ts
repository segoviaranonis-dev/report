import type { CSSProperties } from "react";

/** Orden visual global: año menor (izq) → objetivo (centro) → real actual (der). */
export const COLOR_REAL_ANTERIOR = "#3b82f6"; // blue-500
export const COLOR_OBJETIVO = "rgba(255,255,255,0.22)";
export const COLOR_REAL_ACTUAL = "#eab308"; // yellow-400

export const PIE_CALZADO = "#3b82f6";
export const PIE_CONFECCION = "#eab308";

/** Props comunes de `<Tooltip />` (Recharts): números y etiquetas legibles en tema oscuro. */
export const RIMEC_RECHARTS_TOOLTIP: {
  contentStyle: CSSProperties;
  labelStyle: CSSProperties;
  itemStyle: CSSProperties;
} = {
  contentStyle: {
    backgroundColor: "rgba(0,0,0,0.88)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: "8px",
    color: "#ffffff",
  },
  labelStyle: { color: "#ffffff", fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: "#ffffff" },
};
