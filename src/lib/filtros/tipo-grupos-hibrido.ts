import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import { rowMatchesTipoGrupos, type TipoGrupoId } from "@/lib/filtros/filtro-tipo-canonico";
import {
  parsePeTipoSelected,
  rowMatchesPeTipoDiccionario,
  type PeTipoDiccionarioId,
} from "@/lib/stock-pronta-entrega/filtro-tipo-pe-diccionario";

export type OperativaTipoGrupoId = TipoGrupoId | PeTipoDiccionarioId;

/** Fila con señales PE (diccionario SDRM · depósito legal). */
export function esFilaPeOperativa(r: DepositoRow): boolean {
  if (String(r.columna_stock_legal ?? "").trim()) return true;
  if (String(r.cadena_comercial ?? "").trim()) return true;
  if (String(r.cod_grupo ?? "").trim()) return true;
  if (r.es_liquidacion === true) return true;
  if (String(r.cadena_comercial ?? "").trim().toUpperCase() === "PROMOCIONAL") return true;
  return false;
}

/** Fila con señales CP (biblioteca caso · tránsito). */
export function esFilaCpOperativa(r: DepositoRow): boolean {
  if (r.caso_precio || r.caso_id) return true;
  if (r.proforma || r.pp_nro) return true;
  if (r.quincena_arribo_id || r.pp_id) return true;
  return !esFilaPeOperativa(r);
}

/**
 * Tipo siamese — PE: rowMatchesPeTipoDiccionario · CP: rowMatchesTipoGrupos.
 * Paridad Web `catalogoFilters.ts` (origen TODOS / AM mixto).
 */
export function rowMatchesTipoGruposSiamese(
  r: DepositoRow,
  tipoGrupos: readonly OperativaTipoGrupoId[],
  lineaCasoMap?: Map<string, string> | null,
): boolean {
  if (!tipoGrupos.length) return true;
  const peSel = parsePeTipoSelected(tipoGrupos);
  const cpSel = tipoGrupos.filter(
    (g): g is TipoGrupoId => g !== "comun",
  );
  const hasPe = esFilaPeOperativa(r);
  const hasCp = esFilaCpOperativa(r);
  const peOk = !peSel.length || !hasPe || rowMatchesPeTipoDiccionario(r, peSel);
  const cpOk = !cpSel.length || !hasCp || rowMatchesTipoGrupos(r, cpSel, lineaCasoMap);
  return peOk && cpOk;
}
