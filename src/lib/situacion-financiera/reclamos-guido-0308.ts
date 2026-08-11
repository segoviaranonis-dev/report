/**
 * @deprecated Usar `@/lib/situacion-financiera/reclamos` (catalog.json · 50.31)
 */
import {
  getReclamosCatalog,
  listReclamos,
  LOTE_EXCEL_08_COMENTARIOS,
} from "./reclamos";

export type { ReclamoSitFin as ReclamoGuido } from "./reclamos/types";

/** @deprecated */
export type ReclamoGuidoEstado =
  import("./reclamos/types").ReclamoSitFinEstado;

/** @deprecated · solo lote Excel 08 comentarios */
export const RECLAMOS_GUIDO_0308 = listReclamos().filter(
  (r) => r.loteId === LOTE_EXCEL_08_COMENTARIOS,
);

/** @deprecated */
export const OBSERVACION_FINAL_GUIDO =
  getReclamosCatalog().meta.observacionFinal ?? "";

export { getReclamosCatalog };
