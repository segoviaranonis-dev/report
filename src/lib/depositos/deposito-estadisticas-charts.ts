import type { EstiloDrill } from "@/lib/depositos/deposito-estadisticas-drill";

export const CHART_COLORS = [
  "#1e3a5f",
  "#f97316",
  "#22c55e",
  "#8b5cf6",
  "#ec4899",
  "#0ea5e9",
  "#eab308",
  "#64748b",
];

export type StatSlice = {
  label: string;
  pares: number;
  cajas?: number;
  pct: number;
  value: number;
};

export function colorForIndex(i: number): string {
  return CHART_COLORS[i % CHART_COLORS.length];
}

export type SliceArc = {
  slice: StatSlice;
  index: number;
  color: string;
  startDeg: number;
  endDeg: number;
};

/** Ángulos para SVG donut (0° = arriba, horario). */
export function buildSliceArcs(slices: StatSlice[]): SliceArc[] {
  const total = slices.reduce((s, x) => s + x.value, 0);
  let acc = 0;
  return slices.map((slice, index) => {
    const span = total > 0 ? (slice.value / total) * 360 : 0;
    const startDeg = acc;
    acc += span;
    return {
      slice,
      index,
      color: colorForIndex(index),
      startDeg,
      endDeg: acc,
    };
  });
}

export function conicGradientFromSlices(slices: StatSlice[]): string {
  if (slices.length === 0) return "conic-gradient(#e2e8f0 0deg 360deg)";
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return "conic-gradient(#e2e8f0 0deg 360deg)";

  let acc = 0;
  const stops: string[] = [];
  slices.forEach((s, i) => {
    const deg = (s.value / total) * 360;
    const color = CHART_COLORS[i % CHART_COLORS.length];
    stops.push(`${color} ${acc}deg ${acc + deg}deg`);
    acc += deg;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

export function tonosToSlices(tonos: EstiloDrill["tonos"]): StatSlice[] {
  const total = tonos.reduce((s, t) => s + t.totalPares, 0);
  return tonos.map((t) => ({
    label: t.tono,
    pares: t.totalPares,
    value: t.totalPares,
    pct: total > 0 ? Math.round((t.totalPares / total) * 1000) / 10 : 0,
  }));
}

export function marcasToSlices(
  marcas: { marca: string; totalPares: number }[],
): StatSlice[] {
  const total = marcas.reduce((s, m) => s + m.totalPares, 0);
  return marcas.map((m) => ({
    label: m.marca,
    pares: m.totalPares,
    value: m.totalPares,
    pct: total > 0 ? Math.round((m.totalPares / total) * 1000) / 10 : 0,
  }));
}

export function estilosDrillToSlices(
  items: { estilo: string; totalPares: number }[],
): StatSlice[] {
  const total = items.reduce((s, e) => s + e.totalPares, 0);
  return items.map((e) => ({
    label: e.estilo,
    pares: e.totalPares,
    value: e.totalPares,
    pct: total > 0 ? Math.round((e.totalPares / total) * 1000) / 10 : 0,
  }));
}
