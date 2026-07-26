/**
 * Grupo uno PE — visual + cadena · trillizo siamés con
 * RIMEC Web (`catalogoPeVisual`) y filtro Tipo (`filtro-tipo-canonico`).
 * Prioridad exclusiva: LIQUIDACIÓN → PROMO → NORMAL (REGULAR).
 */
import {
  esLiquidacionRow,
  esPromoRow,
  type RowTipoSignals,
} from "@/lib/filtros/filtro-tipo-canonico";
import { decodeCodGrupo } from "@/lib/pilares/cod-grupo-decode";

export type PeGrupoUnoShell = "normal" | "promo" | "liquidacion" | "comun";

export type RowCadenaPe = RowTipoSignals & { cod_grupo?: string | null };

export function esComunRow(row: RowCadenaPe): boolean {
  if (String(row.cadena_comercial ?? "").trim().toUpperCase() === "COMUN") return true;
  const cg = String(row.cod_grupo ?? "").trim();
  if (!cg) return false;
  const dec = decodeCodGrupo(cg);
  return dec.cadenaComercial === "COMUN";
}

export function resolvePeGrupoUnoShell(row: RowTipoSignals): PeGrupoUnoShell {
  if (esLiquidacionRow(row)) return "liquidacion";
  if (esPromoRow(row)) return "promo";
  if (esComunRow(row)) return "comun";
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

/** Cadena diccionario BD — misma prioridad que badge/filtro (cadena + COD.GRUPO). */
export function cadenaPeCanonico(row: RowCadenaPe): "REGULAR" | "PROMOCIONAL" | "LIQUIDACION" | "COMUN" {
  const shell = resolvePeGrupoUnoShell(row);
  if (shell === "liquidacion") return "LIQUIDACION";
  if (shell === "promo") return "PROMOCIONAL";
  if (shell === "comun") return "COMUN";
  return "REGULAR";
}
