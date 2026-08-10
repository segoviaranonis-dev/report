/**
 * Puente Ola 2 — Bóveda ORO (FI) → evento de cobro → fila sf_pago.
 * No toca registro_ventas_general_v2. No inventa cobro si no hay fecha/medio.
 */

import type { SfCanal, SfHechoEstimado } from "./norte";
import { CHECKLIST_PUENTE_BOVEDA, validarChecklist } from "./checklist-migracion";

export type MedioCobro =
  | "efectivo"
  | "transferencia"
  | "cheque"
  | "nc"
  | "otro";

/** Insumo mínimo desde bóveda / operación (sin asumir schema FI completo). */
export type FiCobroInput = {
  fiId: number;
  fechaPago: string; // YYYY-MM-DD
  importeGs: number;
  importeUsd?: number | null;
  tasaUsd?: number | null;
  moneda?: string;
  medio: MedioCobro;
  canal?: SfCanal;
  codCliente?: string | null;
  documentoId?: string | null;
  notas?: string | null;
};

/** Fila lista para INSERT sf_pago (T13). */
export type SfPagoRow = {
  corte_id: number | null;
  fecha_efecto: string;
  moneda: string;
  importe_gs: number;
  importe_usd: number | null;
  tasa_usd: number | null;
  medio: MedioCobro;
  canal: SfCanal;
  hecho_estimado: SfHechoEstimado;
  documento_tipo: string;
  documento_id: string | null;
  fuente_tipo: "boveda_fi";
  fuente_id: string;
  fi_id: number;
  cod_cliente: string | null;
  notas: string | null;
  extra: Record<string, unknown>;
};

export function checklistPuenteBovedaOk(): boolean {
  return validarChecklist(CHECKLIST_PUENTE_BOVEDA).ok;
}

/**
 * Mapea un cobro de FI a fila sf_pago.
 * Si falta fecha o importe ≤ 0 → null (no inventar).
 */
export function fiCobroASfPago(
  input: FiCobroInput,
  corteId: number | null = null
): SfPagoRow | null {
  if (!input.fechaPago || !Number.isFinite(input.importeGs) || input.importeGs <= 0) {
    return null;
  }
  return {
    corte_id: corteId,
    fecha_efecto: input.fechaPago,
    moneda: input.moneda || "Gs",
    importe_gs: input.importeGs,
    importe_usd: input.importeUsd ?? null,
    tasa_usd: input.tasaUsd ?? null,
    medio: input.medio,
    canal: input.canal || "RIMEC",
    hecho_estimado: "hecho",
    documento_tipo: "FI",
    documento_id: input.documentoId ?? String(input.fiId),
    fuente_tipo: "boveda_fi",
    fuente_id: `fi:${input.fiId}`,
    fi_id: input.fiId,
    cod_cliente: input.codCliente ?? null,
    notas: input.notas ?? null,
    extra: { puente: "boveda_oro_2.3.1.9.B", ola: 2 },
  };
}

/** Etiqueta Bazzar parte relacionada (egreso/previsión) — no mezclar con CxC mayorista. */
export function etiquetaBazzarParteRelacionada(concepto: string): {
  canal: SfCanal;
  origenSitFin: "parte_relacionada";
  concepto: string;
} {
  return {
    canal: "BAZZAR",
    origenSitFin: "parte_relacionada",
    concepto: concepto.includes("BAZZAR") ? concepto : `BAZZAR · ${concepto}`,
  };
}
