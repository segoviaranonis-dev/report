import type { SfCanal, SfEntraSitFin, SfHechoEstimado } from "./norte";

/** Checklist 8 puntos — toda migración/módulo que toque plata. */
export type SfChecklistMigracion = {
  evento: string;
  fechaEfecto: string;
  moneda: string;
  documento: string;
  linaje: string;
  hechoEstimado: SfHechoEstimado;
  canal: SfCanal;
  entraSitFin: SfEntraSitFin;
};

export function validarChecklist(
  c: Partial<SfChecklistMigracion>
): { ok: true; checklist: SfChecklistMigracion } | { ok: false; faltan: string[] } {
  const keys: (keyof SfChecklistMigracion)[] = [
    "evento",
    "fechaEfecto",
    "moneda",
    "documento",
    "linaje",
    "hechoEstimado",
    "canal",
    "entraSitFin",
  ];
  const faltan = keys.filter((k) => {
    const v = c[k];
    return v == null || String(v).trim() === "";
  });
  if (faltan.length) return { ok: false, faltan };
  return { ok: true, checklist: c as SfChecklistMigracion };
}

/** Ejemplo canónico puente bóveda → sf_pago (Ola 2). */
export const CHECKLIST_PUENTE_BOVEDA: SfChecklistMigracion = {
  evento: "cobro",
  fechaEfecto: "fecha_pago",
  moneda: "Gs|USD",
  documento: "FI bóveda / medio cobro",
  linaje: "fuente_tipo=boveda_fi + fi_id + corte_id",
  hechoEstimado: "hecho",
  canal: "RIMEC",
  entraSitFin: "si_auto",
};
