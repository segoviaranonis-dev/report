/**
 * Filtro canónico «Tipo» — casos biblioteca (FK) + señal SDRM (PE / AM).
 * Reutilizable en Reposición, depósitos, PE, RIMEC Web (hermanos siameses).
 *
 * Prioridad exclusiva:
 * - liquidacion: es_liquidacion / cadena LIQUIDACION
 * - promo: es_promo / cadena PROMOCIONAL / caso PROMOCIONAL
 * - carteras | normal: casos biblioteca
 *
 * Fix 2026-07-20: snapshot puede ser Normal (BR-VZ…) mientras SDRM marca promo
 * (línea 1395). Badge y filtro deben coincidir — es_promo gana sobre caso.
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
  linea_codigo?: string | number | null;
  caso_precio?: string | null;
  descp_caso?: string | null;
  caso_id?: number | null;
  cadena_comercial?: string | null;
  es_liquidacion?: boolean | null;
  es_promo?: boolean | null;
};

function casoSnap(row: RowTipoSignals): string {
  return normalizeCasoNombre(row.caso_precio ?? row.descp_caso);
}

export function esLiquidacionRow(row: RowTipoSignals): boolean {
  if (row.es_liquidacion === true) return true;
  return String(row.cadena_comercial ?? "").trim().toUpperCase() === "LIQUIDACION";
}

export function esPromoRow(row: RowTipoSignals): boolean {
  if (row.es_promo === true) return true;
  if (String(row.cadena_comercial ?? "").trim().toUpperCase() === "PROMOCIONAL") {
    return true;
  }
  const snap = casoSnap(row);
  return Boolean(snap && SET_PROMO.has(snap));
}

function casoEfectivo(
  row: RowTipoSignals,
  lineaCasoMap?: Map<string, string> | null,
): string | null {
  const snap = casoSnap(row);
  if (snap && (SET_NORMAL.has(snap) || SET_CARTERAS.has(snap) || SET_PROMO.has(snap))) {
    return snap;
  }
  const fromBcl = lookupCasoLinea(
    lineaCasoMap,
    row.linea_codigo_proveedor ?? row.linea_codigo,
  );
  return fromBcl ? normalizeCasoNombre(fromBcl) : snap || null;
}

/** Grupos «Tipo» que aplican a la fila. Liquidación y Promo son exclusivas. */
export function resolveTipoGruposForRow(
  row: RowTipoSignals,
  lineaCasoMap?: Map<string, string> | null,
): TipoGrupoId[] {
  if (esLiquidacionRow(row)) return ["liquidacion"];
  if (esPromoRow(row)) return ["promo"];

  const out: TipoGrupoId[] = [];
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
