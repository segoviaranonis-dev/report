/** Demos pivote Guido · Cuadro vencimientos + Análisis cobros (LAB / CONTEXTO). */

export type CuadroCelda = {
  fila: string;
  col: string;
  gs: number;
};

export const CUADRO_COLUMNAS = [
  "MAYOR A 180",
  "MAY-26",
  "JUN-26",
  "JUL-26",
  "AGO-26",
  "SEP-26",
  "OCT-26",
  "MAS DE 150",
  "ANTICIPO",
] as const;

export const CUADRO_FILAS = [
  "OK",
  "A ENTREGAR",
  "LUISITO",
  "DIFICIL",
  "CONSIGNACION2",
] as const;

/** Totales orientativos (escala AL) — no sustituyen el HTML auditable Guido. */
export const CUADRO_CELDAS: CuadroCelda[] = [
  { fila: "OK", col: "AGO-26", gs: 2_100_000_000 },
  { fila: "OK", col: "SEP-26", gs: 1_850_000_000 },
  { fila: "OK", col: "OCT-26", gs: 1_200_000_000 },
  { fila: "OK", col: "MAYOR A 180", gs: 134_152_519 },
  { fila: "OK", col: "JUL-26", gs: 1_647_897_209 },
  { fila: "OK", col: "JUN-26", gs: 197_468_699 },
  { fila: "A ENTREGAR", col: "AGO-26", gs: 256_109_218 },
  { fila: "A ENTREGAR", col: "SEP-26", gs: 1_409_144_170 },
  { fila: "LUISITO", col: "AGO-26", gs: 85_000_000 },
  { fila: "LUISITO", col: "SEP-26", gs: 90_000_000 },
  { fila: "DIFICIL", col: "MAYOR A 180", gs: 420_000_000 },
  { fila: "DIFICIL", col: "JUL-26", gs: 110_000_000 },
  { fila: "CONSIGNACION2", col: "ANTICIPO", gs: 45_000_000 },
  { fila: "OK", col: "ANTICIPO", gs: -62_827_243 },
];

export type CobroFila = {
  metrica: string;
  porMes: Record<string, number>;
};

export const COBROS_MESES = ["2026-08", "2026-09", "2026-10", "2026-11"] as const;

export const COBROS_PIVOTE: CobroFila[] = [
  {
    metrica: "Previsto (cheques+PV)",
    porMes: {
      "2026-08": 1_915_766_316 + 256_109_218,
      "2026-09": 1_182_581_582 + 1_409_144_170,
      "2026-10": 640_107_523,
      "2026-11": 158_165_615,
    },
  },
  {
    metrica: "Cobrado líquido (demo)",
    porMes: {
      "2026-08": 1_420_000_000,
      "2026-09": 980_000_000,
      "2026-10": 510_000_000,
      "2026-11": 120_000_000,
    },
  },
  {
    metrica: "Efvo + transferencia",
    porMes: {
      "2026-08": 890_000_000,
      "2026-09": 640_000_000,
      "2026-10": 310_000_000,
      "2026-11": 80_000_000,
    },
  },
  {
    metrica: "Cheques depositados",
    porMes: {
      "2026-08": 530_000_000,
      "2026-09": 340_000_000,
      "2026-10": 200_000_000,
      "2026-11": 40_000_000,
    },
  },
];
