import {
  calcLineaFiPrecio,
  fiListaTier,
  precioTierDesdeSku,
  type SkuPrecioTiers,
} from "@/lib/pedido-proveedor/aritmetica-programado";
import { labelListadoPrecio, type ListadoPrecioTierId } from "@/lib/intencion-compra/listado-precio-tiers";
import type { IcAdminRow, PfArticuloRow, PreFacturaInterna } from "./administrador-ic-query";

export function normAdminEtiqueta(s: string): string {
  return s.trim().toUpperCase();
}

/** IC ↔ PF: mismo cliente y misma marca Excel, o marca IC = caso comercial en proforma. */
export function icParPrefactura(
  ic: Pick<IcAdminRow, "id_cliente" | "id_marca" | "marca">,
  pf: Pick<PreFacturaInterna, "id_cliente" | "id_marca" | "caso">,
): boolean {
  if (ic.id_cliente !== pf.id_cliente) return false;
  if (ic.id_marca === pf.id_marca) return true;
  const caso = pf.caso.trim();
  if (!caso || caso === "—") return false;
  return normAdminEtiqueta(ic.marca) === normAdminEtiqueta(caso);
}

/** IC ↔ PF: cliente + marca + cantidad idénticos. */
export function parejaTripleteIcPf(
  ic: Pick<IcAdminRow, "id_cliente" | "id_marca" | "marca" | "pares">,
  pf: Pick<PreFacturaInterna, "id_cliente" | "id_marca" | "caso" | "total_pares">,
): boolean {
  return icParPrefactura(ic, pf) && ic.pares === pf.total_pares;
}

/** Marca mostrada en grilla PF para alinear con columna IC (caso comercial cuando aplica). */
export function marcaAlineacionPrefactura(
  pf: Pick<PreFacturaInterna, "id_cliente" | "marca" | "caso">,
  ics: Pick<IcAdminRow, "id_cliente" | "marca">[],
): string {
  const caso = pf.caso.trim();
  if (caso && caso !== "—") {
    const icPorCaso = ics.find(
      (ic) => ic.id_cliente === pf.id_cliente && normAdminEtiqueta(ic.marca) === normAdminEtiqueta(caso),
    );
    if (icPorCaso) return icPorCaso.marca;
  }
  return pf.marca;
}

/** Tolerancia en Gs. para «coincide al centavo». */
export const MONTO_MATCH_EXACTO_GS = 1;

/** Tolerancia relativa para «cercano» (1 % del monto IC). */
export const MONTO_MATCH_CERCANO_PCT = 0.01;

export type ParejaMatchNivel = "exacto" | "cercano" | "referencia" | "lejos";

export type ParejaMatchHint = {
  nivel: ParejaMatchNivel;
  delta_monto: number;
  delta_pares: number;
};

export function subtotalSinDescuento(
  sku: SkuPrecioTiers,
  tier: ListadoPrecioTierId,
  pares: number,
): { precio_unit: number; subtotal: number } {
  const precio_unit = precioTierDesdeSku(sku, tier);
  const subtotal = Math.round(precio_unit * pares);
  return { precio_unit, subtotal };
}

export function recalcPfConTier(pf: PreFacturaInterna, tier: ListadoPrecioTierId): PreFacturaInterna {
  let total_monto = 0;
  let total_pares = 0;
  const articulos = pf.articulos.map((art) => {
    const sku: SkuPrecioTiers = {
      lpn: art.lpn,
      lpc02: art.lpc02,
      lpc03: art.lpc03,
      lpc04: art.lpc04,
    };
    const { precio_unit, subtotal } = subtotalSinDescuento(sku, tier, art.pares);
    total_monto += subtotal;
    total_pares += art.pares;
    return { ...art, precio_unit, subtotal };
  });
  return {
    ...pf,
    listado_tier: tier,
    listado_label: labelListadoPrecio(tier),
    total_monto: Math.round(total_monto * 100) / 100,
    total_pares,
    articulos,
  };
}

export function evaluateParejaMatch(
  montoIc: number,
  montoPf: number,
  paresIc: number,
  paresPf: number,
): ParejaMatchHint {
  const delta_monto = Math.round(montoPf - montoIc);
  const delta_pares = paresPf - paresIc;
  const absM = Math.abs(delta_monto);
  const paresOk = delta_pares === 0;

  if (paresOk && absM <= MONTO_MATCH_EXACTO_GS) {
    return { nivel: "exacto", delta_monto, delta_pares };
  }
  const cercanoLim = Math.max(MONTO_MATCH_EXACTO_GS, Math.round(Math.abs(montoIc) * MONTO_MATCH_CERCANO_PCT));
  if (paresOk && absM <= cercanoLim) {
    return { nivel: "cercano", delta_monto, delta_pares };
  }
  if (paresOk) {
    return { nivel: "referencia", delta_monto, delta_pares };
  }
  return { nivel: "lejos", delta_monto, delta_pares };
}

/** Monto FI real (con descuentos IC) para preview post-pareja. */
export function montoFiConDescuentosIc(
  articulos: PfArticuloRow[],
  tier: ListadoPrecioTierId,
  d1: number,
  d2: number,
  d3: number,
  d4: number,
): number {
  let sum = 0;
  for (const art of articulos) {
    const sku: SkuPrecioTiers = {
      lpn: art.lpn,
      lpc02: art.lpc02,
      lpc03: art.lpc03,
      lpc04: art.lpc04,
    };
    const { subtotal } = calcLineaFiPrecio(sku, fiListaTier(tier), d1, d2, d3, d4, art.pares);
    sum += subtotal;
  }
  return Math.round(sum * 100) / 100;
}
