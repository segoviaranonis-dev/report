/** Lote mágico inicial — tarjetas visibles al entrar (Panel CP · PE · CP · Programado). */
export const GRILLA_LOTE_INICIAL = 30;

/** Cuántas tarjetas suma cada scroll al fondo de la grilla. */
export const GRILLA_LOTE_SCROLL = 30;

/**
 * Modo de lote:
 * - unitario: primeras N productos (CP disponible · CP ventas · Programado ventas)
 * - pe-dual-ramo: 30 calzado + 30 confecciones al inicio (Pronta entrega)
 */
export type GrillaLoteModo = "unitario" | "pe-dual-ramo";
