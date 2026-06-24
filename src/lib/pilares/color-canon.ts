/** Pilar color — tono_canon · única verdad filtro (paridad control_central/core/pilares/color_canon.py) */

export type TonoCanonSolido = {
  tipo: "solido";
  etiqueta: string;
  hex: string;
};

export type TonoCanonPaleta = {
  tipo: "paleta";
  etiqueta: string;
  swatches: string[];
};

export type TonoCanon = TonoCanonSolido | TonoCanonPaleta;

const SEP = /[/,\-–|]+/;

/** Primer token antes de separador compuesto (NEGRO/BLANCO → NEGRO). */
export function colorPredominante(nombre: string | null | undefined): string {
  const raw = String(nombre ?? "").trim();
  if (!raw) return "";
  const token = raw.split(SEP)[0]?.trim() ?? raw;
  return (token.split(/\s+/)[0] ?? token).trim();
}

export function normalizarEtiqueta(s: string): string {
  const t = s.trim();
  if (!t) return "";
  return t.length > 1 ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : t.toUpperCase();
}

function normHex(h: string): string {
  const x = h.trim();
  if (!x) return "#94a3b8";
  return (x.startsWith("#") ? x : `#${x}`).toLowerCase();
}

export function tonoSolido(etiqueta: string, hex: string): TonoCanonSolido {
  return { tipo: "solido", etiqueta: normalizarEtiqueta(etiqueta), hex: normHex(hex) };
}

export function tonoPaleta(etiqueta: string, swatches: string[]): TonoCanonPaleta {
  return {
    tipo: "paleta",
    etiqueta: normalizarEtiqueta(etiqueta),
    swatches: swatches.map(normHex).filter(Boolean),
  };
}

export function parseTonoCanon(raw: unknown): TonoCanon | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const etiqueta = String(o.etiqueta ?? "").trim();
  if (!etiqueta) return null;
  if (o.tipo === "solido" && typeof o.hex === "string") return tonoSolido(etiqueta, o.hex);
  if (o.tipo === "paleta" && Array.isArray(o.swatches))
    return tonoPaleta(etiqueta, o.swatches.map(String));
  return null;
}

/** Etiqueta usada en DISTINCT filtros — siempre tono_canon.etiqueta, nunca nombre crudo. */
export function etiquetaFiltro(tono: TonoCanon | null | undefined): string | null {
  const e = tono?.etiqueta?.trim();
  return e || null;
}

/** CSS background para círculo filtro (solido o gradiente paleta). */
export function tonoCircleStyle(tono: TonoCanon | null): { background?: string; backgroundColor?: string } {
  if (!tono) return { backgroundColor: "#e2e8f0" };
  if (tono.tipo === "solido") return { backgroundColor: tono.hex };
  if (tono.swatches.length === 0) return { backgroundColor: "#e2e8f0" };
  if (tono.swatches.length === 1) return { backgroundColor: tono.swatches[0] };
  const step = 100 / tono.swatches.length;
  const stops = tono.swatches.map((h, i) => `${h} ${i * step}% ${(i + 1) * step}%`).join(", ");
  return { background: `conic-gradient(${stops})` };
}
