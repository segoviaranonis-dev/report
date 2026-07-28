/**

 * Grupo uno PE — visual + cadena DPE · trillizo siamés con RIMEC Web.

 * Ley: segregación SOLO triunvirato Excel — ver `cadena-dpe-triunvirato.ts`.

 * BCL (programado + compra previa) no incide en shell ni filtros PE.

 */

import {

  cadenaDpeTriunvirato,

  esComunDpe,

  esLiquidacionDpe,

  esPromoDpe,

  type RowCadenaDpe,

} from "@/lib/stock-pronta-entrega/cadena-dpe-triunvirato";



export type PeGrupoUnoShell = "normal" | "promo" | "liquidacion" | "comun";



export type RowCadenaPe = RowCadenaDpe;



/** @deprecated usar esComunDpe — alias compat */

export function esComunRow(row: RowCadenaPe): boolean {

  return esComunDpe(row);

}



export function resolvePeGrupoUnoShell(row: RowCadenaPe): PeGrupoUnoShell {

  if (esLiquidacionDpe(row)) return "liquidacion";

  if (esPromoDpe(row)) return "promo";

  if (esComunDpe(row)) return "comun";

  return "normal";

}



/** Clases shell tarjeta — paridad `CatalogTarjetaDeposito` Web. */

export function peGrupoUnoShellClass(shell: PeGrupoUnoShell): string {

  switch (shell) {

    case "liquidacion":

      return "catalog-card-casino-oro border-amber-300/85 bg-gradient-to-b from-amber-50/90 via-yellow-50/40 to-white";

    case "promo":

      return "catalog-card-casino-fucsia border-fuchsia-200/90 bg-gradient-to-b from-fuchsia-50/95 via-fuchsia-50/30 to-white";

    case "comun":

      return "catalog-card-casino-comun border-emerald-300/85 bg-gradient-to-b from-emerald-50/90 via-teal-50/35 to-white";

    default:

      return "border-slate-200 bg-gradient-to-b from-slate-100/80 to-white";

  }

}



/** Cadena diccionario DPE — triunvirato COD.GRUPO únicamente. */

export function cadenaPeCanonico(row: RowCadenaPe): "REGULAR" | "PROMOCIONAL" | "LIQUIDACION" | "COMUN" {

  return cadenaDpeTriunvirato(row);

}

