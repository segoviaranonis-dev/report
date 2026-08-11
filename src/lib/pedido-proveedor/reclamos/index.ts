/** Reclamos PP · 2.3.1.7.5.31 — ≠ bugs */
import raw from "./catalog.json";

export type PpReclamoEstado = "abierto" | "en_curso" | "esperando_usuario" | "cerrado";

export type PpReclamo = {
  code: string;
  numero: number;
  fecha: string;
  loteId: string;
  conceptoSitFin: string;
  origen: string;
  textoReclamo: string;
  evidencia?: string;
  reglaCanon?: string;
  nexusAntes?: string;
  respuestaNexus?: string;
  accionNexus?: string;
  estado: PpReclamoEstado;
  docChusar?: string;
  naturaleza: "reclamo";
  ppNumero?: string;
  ppId?: number | null;
};

export type PpReclamosCatalog = {
  meta: { version: number; modulo: string; actualizado: string; notaDistincion: string };
  reclamos: PpReclamo[];
};

const catalog = raw as PpReclamosCatalog;

export function getPpReclamosCatalog(): PpReclamosCatalog {
  return catalog;
}

export function listPpReclamos(): PpReclamo[] {
  return [...catalog.reclamos].sort((a, b) => a.numero - b.numero);
}
