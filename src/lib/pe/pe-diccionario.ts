/**
 * Diccionario Pronta Entrega — tipos y reglas (Report).
 * Fuente BD: pe_diccionario_cadena · MIG-180
 */
export type PeDiccionarioCadenaRow = {
  cadena_pe: string;
  descuento_d1_pct: number;
  es_liquidacion: boolean;
  es_promo: boolean;
  excluir_catalogo: boolean;
  etiqueta_ui: string;
  notas: string | null;
};

export const PE_DICCIONARIO_FALLBACK: PeDiccionarioCadenaRow[] = [
  {
    cadena_pe: "REGULAR",
    descuento_d1_pct: 4,
    es_liquidacion: false,
    es_promo: false,
    excluir_catalogo: false,
    etiqueta_ui: "NORMAL",
    notas: null,
  },
  {
    cadena_pe: "PROMOCIONAL",
    descuento_d1_pct: 2,
    es_liquidacion: false,
    es_promo: true,
    excluir_catalogo: false,
    etiqueta_ui: "PROMOCIONAL",
    notas: null,
  },
  {
    cadena_pe: "LIQUIDACION",
    descuento_d1_pct: 2,
    es_liquidacion: true,
    es_promo: false,
    excluir_catalogo: false,
    etiqueta_ui: "LIQUIDACION",
    notas: null,
  },
  {
    cadena_pe: "COMUN",
    descuento_d1_pct: 4,
    es_liquidacion: false,
    es_promo: false,
    excluir_catalogo: false,
    etiqueta_ui: "COMUN",
    notas: "TIPO1 Carlos · d45=06",
  },
];

export function cadenaPeNormalizada(raw: string | null | undefined): string {
  const u = String(raw ?? "REGULAR").trim().toUpperCase();
  if (u === "LIQUIDACION" || u === "LIQUIDACIÓN") return "LIQUIDACION";
  if (u === "PROMOCIONAL" || u === "PROMO") return "PROMOCIONAL";
  if (u === "COMUN" || u === "COMÚN") return "COMUN";
  if (u === "NORMAL") return "REGULAR";
  return "REGULAR";
}

export function descuentoD1Fallback(cadena: string | null | undefined): number {
  const c = cadenaPeNormalizada(cadena);
  const row = PE_DICCIONARIO_FALLBACK.find((r) => r.cadena_pe === c);
  return row?.descuento_d1_pct ?? 4;
}
