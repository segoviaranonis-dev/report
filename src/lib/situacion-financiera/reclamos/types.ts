/**
 * Entorno Reclamos Sit Fin · 2.3.1.50.31
 *
 * RECLAMO ≠ BUG
 * - Reclamo: observación del director de finanzas (Guido) sobre semántica / canon SF.
 *   No va a protocolo_errores.md ni keyword Bug urgente.
 * - Bug: fallo técnico app (hotfix, 4.xx.xx, protocolo_errores).
 */

export type ReclamoSitFinEstado =
  | "abierto"
  | "en_curso"
  | "verificado_canon"
  | "verificado_txt"
  | "esperando_guido"
  | "cerrado"
  | "no_aplica_sf_al";

export type ReclamoSitFinOrigen = "guido_excel" | "guido_verbal" | "auditoria_interna";

export type ReclamoSitFin = {
  /** Identificador estable · SF-REC-NNN */
  code: string;
  numero: number;
  fecha: string;
  /** Agrupa reclamos del mismo Excel / corte */
  loteId: string;
  conceptoSitFin: string;
  origen: ReclamoSitFinOrigen;
  /** Texto literal del reclamante */
  textoReclamo: string;
  evidencia?: string;
  reglaCanon?: string;
  nexusAntes?: string;
  respuestaNexus?: string;
  accionNexus?: string;
  decisionGuido?: string;
  estado: ReclamoSitFinEstado;
  docChusar?: string;
  commitDeploy?: string;
  /** Siempre "reclamo" — nunca "bug" */
  naturaleza: "reclamo";
};

export type ReclamosCatalogMeta = {
  version: number;
  modulo: string;
  actualizado: string;
  esperandoRespuestaGuido: boolean;
  esperandoDesde?: string;
  observacionFinal?: string;
  notaDistincion: string;
};

export type ReclamosCatalog = {
  meta: ReclamosCatalogMeta;
  reclamos: ReclamoSitFin[];
};
