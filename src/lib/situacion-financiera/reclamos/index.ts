import raw from "./catalog.json";
import type {
  ReclamoSitFin,
  ReclamoSitFinEstado,
  ReclamosCatalog,
} from "./types";

export type {
  ReclamoSitFin,
  ReclamoSitFinEstado,
  ReclamoSitFinOrigen,
  ReclamosCatalog,
  ReclamosCatalogMeta,
} from "./types";

const catalog = raw as ReclamosCatalog;

export function getReclamosCatalog(): ReclamosCatalog {
  return catalog;
}

export function listReclamos(): ReclamoSitFin[] {
  return [...catalog.reclamos].sort((a, b) => a.numero - b.numero);
}

export function getReclamoByCode(code: string): ReclamoSitFin | undefined {
  return catalog.reclamos.find((r) => r.code === code);
}

export function listReclamosByLote(loteId: string): ReclamoSitFin[] {
  return catalog.reclamos.filter((r) => r.loteId === loteId);
}

export function countByEstado(): Record<ReclamoSitFinEstado, number> {
  const base: Record<ReclamoSitFinEstado, number> = {
    abierto: 0,
    en_curso: 0,
    verificado_canon: 0,
    verificado_txt: 0,
    esperando_guido: 0,
    cerrado: 0,
    no_aplica_sf_al: 0,
  };
  for (const r of catalog.reclamos) {
    base[r.estado] = (base[r.estado] ?? 0) + 1;
  }
  return base;
}

export function isEsperandoRespuestaGuido(): boolean {
  return catalog.meta.esperandoRespuestaGuido === true;
}

/** Lote activo Excel 08 comentarios (re-export UI legacy) */
export const LOTE_EXCEL_08_COMENTARIOS = "excel-08-comentarios-0308";
