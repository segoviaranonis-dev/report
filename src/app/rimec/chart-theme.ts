import type { CSSProperties } from "react";

/** Orden visual global: año menor (izq) → objetivo (centro) → real actual (der). */
export const COLOR_REAL_ANTERIOR = "#002B4E"; // RIMEC NIIF
export const COLOR_OBJETIVO = "rgba(255,255,255,0.22)";
export const COLOR_REAL_ACTUAL = "#ea580c"; // BAZZAR NIIF

export const PIE_CALZADO = "#002B4E";
export const PIE_CONFECCION = "#ea580c";

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
