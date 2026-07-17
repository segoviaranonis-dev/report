/**
 * Filtro canónico «Tipo» — casos biblioteca (FK) + señal SDRM liquidación (PE).
 * Reutilizable en Reposición, depósitos, PE, etc.
 *
 * Grupos:
 * - normal: ACT-BRSPORT · BR-VZ-MD-MKA-O (alias BR-VZ-MD-ML-MKA-O)
 * - carteras: CARTERAS
 * - promo: PROMOCIONAL
 * - liquidacion: es_liquidacion / cadena_comercial LIQUIDACION (Alejandro Magno)
 */
import {
  lookupCasoLinea,
  normalizeCasoNombre,
} from "@/lib/depositos/caso-biblioteca";

export type TipoGrupoId = "normal" | "carteras" | "promo" | "liquidacion";

export const TIPO_GRUPO_OPCIONES: ReadonlyArray<{ id: TipoGrupoId; label: string }> = [
  { id: "normal", label: "Normal" },
  { id: "carteras", label: "Carteras" },
  { id: "promo", label: "Promo" },
  { id: "liquidacion", label: "Liquidación" },
] as const;

/** Casos biblioteca → grupo Normal (nombre_caso / descp_caso_snapshot). */
export const CASOS_TIPO_NORMAL = [
  "ACT-BRSPORT",
  "BR-VZ-MD-MKA-O",
  "BR-VZ-MD-ML-MKA-O",
] as const;

const SET_NORMAL = new Set<string>(CASOS_TIPO_NORMAL);
const SET_CARTERAS = new Set<string>(["CARTERAS"]);
const SET_PROMO = new Set<string>(["PROMOCIONAL"]);

export type RowTipoSignals = {
  linea_codigo_proveedor?: string | number | null;
  caso_precio?: string | null;
  caso_id?: number | null;
  cadena_comercial?: string | null;
  es_liquidacion?: boolean | null;
};

function casoEfectivo(
  row: RowTipoSignals,
  lineaCasoMap?: Map<string, string> | null,
): string | null {
  const snap = normalizeCasoNombre(row.caso_precio);
  if (snap) return snap;
  const fromBcl = lookupCasoLinea(lineaCasoMap, row.linea_codigo_proveedor);
  return fromBcl ? normalizeCasoNombre(fromBcl) : null;
}

export function esLiquidacionRow(row: RowTipoSignals): boolean {
  if (row.es_liquidacion === true) return true;
  return String(row.cadena_comercial ?? "").trim().toUpperCase() === "LIQUIDACION";
}

/** Grupos «Tipo» que aplican a la fila (puede ser >1 si liquidación + caso). */
export function resolveTipoGruposForRow(
  row: RowTipoSignals,
  lineaCasoMap?: Map<string, string> | null,
): TipoGrupoId[] {
  const out: TipoGrupoId[] = [];
  if (esLiquidacionRow(row)) out.push("liquidacion");

  const caso = casoEfectivo(row, lineaCasoMap);
  if (caso) {
    if (SET_NORMAL.has(caso)) out.push("normal");
    else if (SET_CARTERAS.has(caso)) out.push("carteras");
    else if (SET_PROMO.has(caso)) out.push("promo");
  }
  return out;
}

export function rowMatchesTipoGrupos(
  row: RowTipoSignals,
  selected: readonly TipoGrupoId[],
  lineaCasoMap?: Map<string, string> | null,
): boolean {
  if (!selected.length) return true;
  const grupos = resolveTipoGruposForRow(row, lineaCasoMap);
  if (!grupos.length) return false;
  return selected.some((g) => grupos.includes(g));
}

export function toggleTipoGrupo(
  list: TipoGrupoId[],
  id: TipoGrupoId,
): TipoGrupoId[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}
