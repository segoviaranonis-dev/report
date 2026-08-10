/** Norte Sit Fin — subordinado a ISLA Faro de Alejandría (2.3.1.50.12). */

import { SF_ISLA } from "./isla";

export const SF_NORTE = {
  frase:
    "¿Qué evento de caja/cobro/compromiso genero, con qué fecha, moneda y documento?",
  ordenMadurez: "caja_primero" as const,
  /** Paralelo hoy; integración Nexus operativa = puerta Director cuando madure. */
  verdad: "isla_paralela_erp_txt" as const,
  isla: SF_ISLA,
  olas: [
    "corazon_operativo_isla",
    "puente_boveda_pago_LAB",
    "corte_cerrado_ui_LAB",
    "ratios_sin_mentir_LAB",
  ] as const,
  blindajes: [
    "sales_report_registro_ventas_general_v2",
    "pilares_no_contabilidad",
    "sf_isla_sin_resultados_nexus",
    "sf_sin_corte_supabase_operativo",
  ],
} as const;

export type SfCanal = "RIMEC" | "BAZZAR" | "HOLDING";
export type SfEntraSitFin = "si_auto" | "si_manual" | "no" | "control_fuera";
export type SfHechoEstimado = "hecho" | "estimado";
