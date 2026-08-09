/** Situación financiera Rimec · 2.3.1.50 */

export type SfOrigen = "auto" | "manual" | "pendiente" | "calculado";

export type SfLinea = {
  concepto: string;
  importeGs: number | null;
  origen: SfOrigen;
  nota?: string;
};

export type SfBloqueMes = {
  mesYm: string;
  etiqueta: string;
  lineas: SfLinea[];
  saldoDisponibleGs: number | null;
};

/** Nodo de detalle molecular (acordeón multi-nivel). */
export type MolNode = {
  id: string;
  label: string;
  gs?: number | null;
  usd?: number | null;
  meta?: string;
  /** Archivo TXT / Excel que respalda el nodo */
  fuente?: string;
  /** Línea limpia del TXT (documentación molecular) */
  doc?: string;
  children?: MolNode[];
};

export type ExcelAlRow = {
  kind:
    | "spacer"
    | "row"
    | "section"
    | "subheader"
    | "tasa"
    | "prevision"
    | "total_yellow"
    | "total_green"
    | "total_gray"
    | "reserva";
  r: number;
  mes?: string | null;
  label?: string;
  gs?: number | null;
  usd?: number | null;
  bold?: boolean;
};

export type SfCorteResumen = {
  fechaAl: string;
  tasaUsd: number;
  fuente: string;
  estadoPipeline: string;
  nVariaciones: number;
  bloques: SfBloqueMes[];
  aging: { key: string; label: string; importeGs: number }[];
  chequesPorMes: { mesYm: string; importeGs: number }[];
  pvProgPorMes: { mesYm: string; importeGs: number }[];
  cicloEconomico: { id: string; label: string; desc: string }[];
};
