/** tipo_v2 (catálogo) → proveedor_importacion.id en pilares */
export const TIPO_V2_LABELS: Record<1 | 2, string> = {
  1: "Calzados (Beira Rio · 654)",
  2: "Confecciones (Kyly · 638)",
};

/** Estilos permitidos por ámbito — evita mezclar calzado ↔ confecciones en filtros/edición. */
export const ESTILOS_POR_TIPO_V2: Record<1 | 2, readonly string[]> = {
  1: [
    "BOTAS",
    "CARTERAS",
    "CHATITA",
    "CROCS",
    "OTROS",
    "PAPETTE",
    "RASTRERAS",
    "SANDALIA",
    "SEMIABIERTO",
    "STILETTO",
    "TACO ALTO",
    "TACO BAJO",
    "TACO MEDIO",
    "TENIS",
    "ZAPATILLA",
  ],
  2: ["CONFECCIONES", "OTROS"],
};

/** Tipo 1 permitido por ámbito (SDRM · pilares). */
export const TIPO1_POR_TIPO_V2: Record<1 | 2, readonly string[]> = {
  1: ["ABIERTO", "CERRADO", "CARTERAS", "MEDIAS", "PRENDAS"],
  2: ["VERANO", "INVIERNO", "ACT ROPAS"],
};

/** Etiqueta UI cabecera filtros — Kyly 638 usa TEMPORADA (col G Excel). */
export const TIPO1_UI_LABEL: Record<1 | 2, string> = {
  1: "Tipo 1",
  2: "Temporada",
};

export function tipo1UiLabelForFiltros(tipoV2Ids: number[]): string {
  if (tipoV2Ids.length === 1 && tipoV2Ids[0] === 2) return TIPO1_UI_LABEL[2];
  if (tipoV2Ids.length === 1 && tipoV2Ids[0] === 1) return TIPO1_UI_LABEL[1];
  return "Tipo 1 / Temporada";
}

export function normMaestraLabel(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

export function estiloPermitidoParaTipoV2(tipoV2Id: 1 | 2, label: string): boolean {
  const key = normMaestraLabel(label);
  return ESTILOS_POR_TIPO_V2[tipoV2Id].some((e) => normMaestraLabel(e) === key);
}

export function tipo1PermitidoParaTipoV2(tipoV2Id: 1 | 2, label: string): boolean {
  const key = normMaestraLabel(label);
  return TIPO1_POR_TIPO_V2[tipoV2Id].some((t) => normMaestraLabel(t) === key);
}

export function proveedorIdFromTipoV2(tipoV2Id: number): number | null {
  if (tipoV2Id === 1) return 654;
  if (tipoV2Id === 2) return 638;
  return null;
}

export function parseTipoV2Id(raw: string | null | undefined): 1 | 2 {
  const n = Number(raw);
  return n === 2 ? 2 : 1;
}
