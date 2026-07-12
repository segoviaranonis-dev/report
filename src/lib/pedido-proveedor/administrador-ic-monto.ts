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
  const caso = String(pf.caso ?? "—").trim();
  if (!caso || caso === "—") return false;
  return normAdminEtiqueta(ic.marca) === normAdminEtiqueta(caso);
}

/** Estado Protocolo Chusa — 3 niveles (contadores · canon · lote). */
export type ProtocoloChusaEstado = {
  contadorIc: number;
  contadorPf: number;
  nivel1: boolean;
  nivel2: boolean;
  puedeLote: boolean;
};

export function evalProtocoloChusa(
  icsVisibles: IcAdminRow[],
  pfVisibles: PreFacturaInterna[],
  icsAll: Pick<IcAdminRow, "id_cliente" | "marca">[],
): ProtocoloChusaEstado {
  const contadorIc = icsVisibles.length;
  const contadorPf = pfVisibles.length;
  const nivel1 = contadorIc > 0 && contadorIc === contadorPf;
  let nivel2 = false;
  if (nivel1) {
    nivel2 = true;
    for (let i = 0; i < contadorIc; i++) {
      const marcaPf = marcaAlineacionPrefactura(pfVisibles[i], icsAll);
      if (!tripleteColumnasExacto(icsVisibles[i], pfVisibles[i], marcaPf)) {
        nivel2 = false;
        break;
      }
    }
  }
  return {
    contadorIc,
    contadorPf,
    nivel1,
    nivel2,
    puedeLote: nivel1 && nivel2,
  };
}

/** Parejas alineadas renglón i ↔ i (solo si Nivel 2 OK). */
export function parejasLoteAlineadas(
  icsVisibles: IcAdminRow[],
  pfVisibles: PreFacturaInterna[],
): Array<{ ic: IcAdminRow; pf: PreFacturaInterna }> {
  return icsVisibles.map((ic, i) => ({ ic, pf: pfVisibles[i] }));
}

/** IC ↔ PF: cliente + marca (columna grilla) + cantidad — sin tolerancia. */
export function tripleteColumnasExacto(
  ic: Pick<IcAdminRow, "id_cliente" | "marca" | "pares">,
  pf: Pick<PreFacturaInterna, "id_cliente" | "total_pares">,
  marcaPf: string,
): boolean {
  return (
    ic.id_cliente === pf.id_cliente &&
    ic.pares === pf.total_pares &&
    normAdminEtiqueta(ic.marca) === normAdminEtiqueta(marcaPf)
  );
}

/** Desvío canon renglón i ↔ i (cliente · marca · cant.) — solo resaltar lo que difiere. */
export type CanonDiffCelda = {
  cliente: boolean;
  marca: boolean;
  cantidad: boolean;
  sinPar: boolean;
};

export function evalCanonDiffFila(
  ic: Pick<IcAdminRow, "id_cliente" | "marca" | "pares"> | undefined,
  pf: Pick<PreFacturaInterna, "id_cliente" | "total_pares"> | undefined,
  marcaPf: string,
): CanonDiffCelda {
  if (!ic || !pf) {
    return { cliente: true, marca: true, cantidad: true, sinPar: true };
  }
  return {
    cliente: ic.id_cliente !== pf.id_cliente,
    marca: normAdminEtiqueta(ic.marca) !== normAdminEtiqueta(marcaPf),
    cantidad: ic.pares !== pf.total_pares,
    sinPar: false,
  };
}

export function tieneDesajusteCanon(d: CanonDiffCelda): boolean {
  return d.sinPar || d.cliente || d.marca || d.cantidad;
}

export function canonDiffsPorIndice(
  icsVisibles: IcAdminRow[],
  pfVisibles: PreFacturaInterna[],
  icsAll: Pick<IcAdminRow, "id_cliente" | "marca">[],
): { ic: CanonDiffCelda[]; pf: CanonDiffCelda[]; desajustes: number } {
  const maxLen = Math.max(icsVisibles.length, pfVisibles.length);
  const icOut: CanonDiffCelda[] = [];
  const pfOut: CanonDiffCelda[] = [];
  let desajustes = 0;
  for (let i = 0; i < maxLen; i++) {
    const ic = icsVisibles[i];
    const pf = pfVisibles[i];
    const marcaPf = pf ? marcaAlineacionPrefactura(pf, icsAll) : "";
    const diff = evalCanonDiffFila(ic, pf, marcaPf);
    icOut[i] = diff;
    pfOut[i] = diff;
    if (tieneDesajusteCanon(diff)) desajustes++;
  }
  return { ic: icOut, pf: pfOut, desajustes };
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
  const caso = String(pf.caso ?? "—").trim();
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

/** Orden canon lote — misma regla UI Administrador IC. */
export function cmpAdminFilasLote(
  clienteA: number,
  marcaA: string,
  paresA: number,
  montoA: number,
  tieA: string,
  clienteB: number,
  marcaB: string,
  paresB: number,
  montoB: number,
  tieB: string,
) {
  const a = String(tieA ?? "");
  const b = String(tieB ?? "");
  return (
    clienteA - clienteB ||
    marcaA.localeCompare(marcaB, "es") ||
    paresA - paresB ||
    montoA - montoB ||
    a.localeCompare(b, "es")
  );
}

export function ordenarUniversoLoteChusa(ics: IcAdminRow[], prefacturas: PreFacturaInterna[]) {
  const icsOrden = [...ics].sort((a, b) =>
    cmpAdminFilasLote(
      a.id_cliente,
      a.marca,
      a.pares,
      a.monto_ic,
      a.nro_ic,
      b.id_cliente,
      b.marca,
      b.pares,
      b.monto_ic,
      b.nro_ic,
    ),
  );
  const pfOrden = [...prefacturas].sort((a, b) =>
    cmpAdminFilasLote(
      a.id_cliente,
      marcaAlineacionPrefactura(a, ics),
      a.total_pares,
      a.total_monto,
      a.caso,
      b.id_cliente,
      marcaAlineacionPrefactura(b, ics),
      b.total_pares,
      b.total_monto,
      b.caso,
    ),
  );
  return { icsOrden, pfOrden };
}

export type ParejaLoteFi = { ic_id: number; ic_nro: string; ppd_ids: number[] };

export function construirParejasLoteChusa(
  ics: IcAdminRow[],
  prefacturas: PreFacturaInterna[],
):
  | { ok: true; parejas: ParejaLoteFi[]; chusa: ProtocoloChusaEstado }
  | { ok: false; error: string; chusa: ProtocoloChusaEstado } {
  const { icsOrden, pfOrden } = ordenarUniversoLoteChusa(ics, prefacturas);
  const chusa = evalProtocoloChusa(icsOrden, pfOrden, ics);
  if (!chusa.puedeLote) {
    return { ok: false, error: "Protocolo Chusa: contadores o canon no cuadran.", chusa };
  }
  const parejas = parejasLoteAlineadas(icsOrden, pfOrden).map(({ ic, pf }) => ({
    ic_id: ic.ic_id,
    ic_nro: ic.nro_ic,
    ppd_ids: pf.articulos.map((a) => Number(a.ppd_id)).filter((n) => Number.isFinite(n) && n > 0),
  }));
  return { ok: true, parejas, chusa };
}
