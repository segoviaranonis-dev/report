/**
 * Aritmética canónica PROGRAMADO — paridad Python logic.py · CHUSAR Alejandro Magno.
 * Toda mutación de precio/FI debe usar estas funciones (no duplicar en UI).
 */

import type { ListadoPrecioTierId } from "@/lib/intencion-compra/listado-precio-tiers";

export type SkuPrecioTiers = {
  lpn: number;
  lpc02: number;
  lpc03: number;
  lpc04: number;
};

/** Descuentos cabecera IC/FI en % entero (50 = 50%). */
export function factorDescuentosFiPct(d1: number, d2: number, d3: number, d4: number): number {
  let factor = 1;
  for (const d of [d1, d2, d3, d4]) {
    const n = Number(d);
    if (Number.isFinite(n) && n > 0) factor *= 1 - n / 100;
  }
  return factor;
}

/** FOB proforma — mismos % que cabecera IC. */
export function calcFobAjustadoPct(fob: number, d1: number, d2: number, d3: number, d4: number): number {
  return Math.round(fob * factorDescuentosFiPct(d1, d2, d3, d4) * 10000) / 10000;
}

/** Normaliza lista_precio_id FI → tier 1–4 (legacy >4 → LPN). */
export function fiListaTier(listaPrecioId: unknown): ListadoPrecioTierId {
  const n = Number(listaPrecioId ?? 1);
  if (n === 2 || n === 3 || n === 4) return n;
  return 1;
}

const TIER_COL: Record<ListadoPrecioTierId, keyof SkuPrecioTiers> = {
  1: "lpn",
  2: "lpc02",
  3: "lpc03",
  4: "lpc04",
};

/** Precio unitario tier desde fila precio_lista (SQL ya trajo columnas). */
export function precioTierDesdeSku(sku: SkuPrecioTiers, tier: ListadoPrecioTierId): number {
  const col = TIER_COL[fiListaTier(tier)];
  const val = Number(sku[col] ?? 0);
  if (val > 0) return val;
  return Number(sku.lpn ?? 0);
}

/** Línea FI: precio_neto = tier × factor descuentos IC. */
export function calcLineaFiPrecio(
  sku: SkuPrecioTiers,
  tier: ListadoPrecioTierId,
  d1: number,
  d2: number,
  d3: number,
  d4: number,
  pares: number,
): { precio_unit: number; precio_neto: number; subtotal: number } {
  const precio_unit = precioTierDesdeSku(sku, tier);
  const precio_neto = Math.round(precio_unit * factorDescuentosFiPct(d1, d2, d3, d4));
  const subtotal = Math.round(pares * precio_neto);
  return { precio_unit, precio_neto, subtotal };
}

/** SQL CASE tier → columna precio_lista (usar en queries parametrizadas). */
export function sqlCasePrecioListaTier(tierParam: string): string {
  return `CASE ${tierParam}
    WHEN 2 THEN COALESCE(pl.lpc02, 0)
    WHEN 3 THEN COALESCE(pl.lpc03, 0)
    WHEN 4 THEN COALESCE(pl.lpc04, 0)
    ELSE COALESCE(pl.lpn, 0)
  END`;
}
