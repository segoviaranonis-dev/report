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
 *
 * Fix 2026-07-24 Mario Bros (4.01.04.003): Calzado excluye carteras por defecto;
 * carteras viven en Categoría «Carteras y accesorios» / chip Tipo → Carteras.
 */
import {
  lookupCasoLinea,
  normalizeCasoNombre,
} from "@/lib/depositos/caso-biblioteca";
import {
  esFilaModuloAccesorios,
  esRamoAccesorios,
} from "@/lib/filtros/modulo-accesorios";

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
  es_liquidacion?: boolean | number | string | null;
  es_promo?: boolean | number | string | null;
};

function casoSnap(row: RowTipoSignals): string {
  return normalizeCasoNombre(row.caso_precio ?? row.descp_caso);
}

export function esLiquidacionRow(row: RowTipoSignals): boolean {
  if (row.es_liquidacion === true || row.es_liquidacion === 1) return true;
  if (String(row.es_liquidacion ?? "").trim().toLowerCase() === "true") return true;
  return String(row.cadena_comercial ?? "").trim().toUpperCase() === "LIQUIDACION";
}

export function esPromoRow(row: RowTipoSignals): boolean {
  if (row.es_promo === true || row.es_promo === 1) return true;
  if (String(row.es_promo ?? "").trim().toLowerCase() === "true") return true;
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

/** Mario Bros / grupo uno · Calzado → TIPO solo Normal · Promo · Liquidación. ACCESORIOS → sin chip Tipo. */
export function tipoGrupoOpcionesVisibles(ramo_tipo?: string): typeof TIPO_GRUPO_OPCIONES {
  const ramo = String(ramo_tipo ?? "").trim().toUpperCase();
  if (ramo === "ACCESORIOS") return [];
  if (ramo === "CALZADO") return TIPO_GRUPO_OPCIONES.filter((o) => o.id !== "carteras");
  return TIPO_GRUPO_OPCIONES;
}

export function sanitizeTipoGruposParaRamo(
  tipo_grupos: readonly TipoGrupoId[] | undefined,
  ramo_tipo?: string,
): TipoGrupoId[] {
  const list = [...(tipo_grupos ?? [])];
  if (esRamoAccesorios(ramo_tipo)) return [];
  if (String(ramo_tipo ?? "").trim().toUpperCase() !== "CALZADO") return list;
  return list.filter((g) => g !== "carteras");
}

/** @deprecated usar esFilaModuloAccesorios */
export function esFilaCarteraCatalogo(
  row: RowTipoSignals & {
    estilo?: string | null;
    tipo_1?: string | null;
    descp_grupo_estilo?: string | null;
    descp_tipo_1?: string | null;
  },
  lineaCasoMap?: Map<string, string> | null,
): boolean {
  return esFilaModuloAccesorios(row, lineaCasoMap);
}

/**
 * Calzado por defecto = calzado puro; carteras solo con chip Tipo explícito
 * o categoría «Carteras y accesorios».
 */
export function calzadoExcluyeCarterasPorDefecto(filters: {
  ramoTipo?: string | null;
  tipoV2Ids?: number[];
  tipoGrupos?: readonly TipoGrupoId[];
}): boolean {
  const ramo = String(filters.ramoTipo ?? "").trim().toUpperCase();
  if (ramo === "ACCESORIOS" || ramo === "CONFECCIONES") return false;
  const isCalzado =
    ramo === "CALZADO" ||
    ((filters.tipoV2Ids?.length ?? 0) === 1 && filters.tipoV2Ids![0] === 1);
  if (!isCalzado) return false;
  return !(filters.tipoGrupos ?? []).includes("carteras");
}

export { normalizeCasoNombre };
