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
  label: string;
  gs: number | null;
  usd: number | null;
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
