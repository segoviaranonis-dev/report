/** Categorías comerciales IC/PP — Alejandro Magno (categoria_v2). */

export const CATEGORIA_STOCK_ID = 1;
export const CATEGORIA_COMPRA_PREVIA_ID = 2;
export const CATEGORIA_PROGRAMADO_ID = 3;

export type RamoDigitacion = "compra_previa" | "programado";

export function ramoFromCategoriaId(categoriaId: number | null | undefined): RamoDigitacion | null {
  if (categoriaId === CATEGORIA_COMPRA_PREVIA_ID) return "compra_previa";
  if (categoriaId === CATEGORIA_PROGRAMADO_ID) return "programado";
  return null;
}

export function categoriaIdFromRamo(ramo: RamoDigitacion): number {
  return ramo === "programado" ? CATEGORIA_PROGRAMADO_ID : CATEGORIA_COMPRA_PREVIA_ID;
}

export function labelRamoDigitacion(ramo: RamoDigitacion): string {
  return ramo === "programado" ? "Programado" : "Compra previa";
}

/** Alejandro Magno — flag comercial en PP (derivado de categoria_id si no hay columna). */
export function compraPreviaFromCategoria(categoriaId: number | null | undefined): boolean | null {
  if (categoriaId === CATEGORIA_COMPRA_PREVIA_ID) return true;
  if (categoriaId === CATEGORIA_PROGRAMADO_ID) return false;
  return null;
}

export function isProgramadoIc(categoriaId: number | null | undefined): boolean {
  return categoriaId === CATEGORIA_PROGRAMADO_ID;
}
