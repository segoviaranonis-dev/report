import type { SfCorteResumen } from "./types";

/** Corte LAB AL 03-08-26 — números AUTO del pipeline Nexus (cheques/PV/aging).
 *  Manuales (bancos/gastos) alineados al Excel objetivo SF AL 03-08.xlsx.
 *  Norte visual: plantilla Guido · Excel manda.
 */
export const DEMO_CORTE_AL_0308: SfCorteResumen = {
  fechaAl: "2026-08-03",
  tasaUsd: 5970.96,
  fuente: "pipeline LAB · intake corte-AL-03-08-26 · guía Guido (D:\\SF)",
  estadoPipeline: "cerrado",
  nVariaciones: 0,
  cicloEconomico: [
    {
      id: "cxc",
      label: "CxC / cuotas",
      desc: "Saldos → explosión cuotas → aging / difícil cobro",
    },
    {
      id: "cheques",
      label: "Cheques a vencer",
      desc: "Cobro instrumentado por mes (TXT ifcqvg$)",
    },
    {
      id: "pv",
      label: "PV y PROG",
      desc: "Mercadería a entregar / cobro programado",
    },
    {
      id: "cobros",
      label: "Cobros del mes",
      desc: "Previsto × cobrado · líquido efvo+transf",
    },
    {
      id: "egresos",
      label: "Egresos",
      desc: "Proveedores · gastos · despacho · préstamo (manual)",
    },
    {
      id: "disponible",
      label: "Saldo disponible",
      desc: "Acumula mes a mes → tablero gerencial",
    },
  ],
  chequesPorMes: [
    { mesYm: "2026-08", importeGs: 1_915_766_316 },
    { mesYm: "2026-09", importeGs: 1_182_581_582 },
    { mesYm: "2026-10", importeGs: 640_107_523 },
    { mesYm: "2026-11", importeGs: 158_165_615 },
    { mesYm: "2026-12", importeGs: 103_460_486 },
  ],
  pvProgPorMes: [
    { mesYm: "2026-08", importeGs: 256_109_218 },
    { mesYm: "2026-09", importeGs: 1_409_144_170 },
  ],
  aging: [
    { key: "v30", label: "Vencidos 30 días", importeGs: 1_647_897_209 },
    { key: "v60", label: "Vencidos 60 días", importeGs: 197_468_699 },
    { key: "v90", label: "Vencidos 90 días", importeGs: 266_975_386 },
    { key: "v120", label: "Vencidos 120 días", importeGs: 33_923_817 },
    { key: "v150", label: "Vencidos 150 días", importeGs: 140_359_557 },
    { key: "v180", label: "Vencidos 180 días", importeGs: 16_604_422 },
    { key: "v180p", label: "Mayor a 180 días", importeGs: 134_152_519 },
    { key: "no_vencido", label: "No vencidos", importeGs: 0 },
  ],
  bloques: [
    {
      mesYm: "2026-08",
      etiqueta: "AGOSTO 2026",
      lineas: [
        {
          concepto: "CHEQUES A VENCER",
          importeGs: 1_915_766_316,
          origen: "auto",
          nota: "TXT cheques AGO26",
        },
        {
          concepto: "SALDO DE CLIENTES",
          importeGs: null,
          origen: "pendiente",
          nota: "Verde cuadro / detalle auditable Guido",
        },
        {
          concepto: "MERCADERIAS A ENTREGAR",
          importeGs: null,
          origen: "pendiente",
          nota: "Fila A ENTREGAR del cuadro",
        },
        {
          concepto: "SALDO CLIENTES VENCIDOS 30 DÍAS",
          importeGs: 1_647_897_209,
          origen: "auto",
          nota: "Aging detallado",
        },
        {
          concepto: "SALDO CLIENTES VENCIDOS 60 DÍAS",
          importeGs: 197_468_699,
          origen: "auto",
        },
        {
          concepto: "PAGOS BAZZAR",
          importeGs: null,
          origen: "manual",
          nota: "VTO.BAZZAR / previsión",
        },
        {
          concepto: "PV Y PROG A COBRAR",
          importeGs: 256_109_218,
          origen: "auto",
          nota: "PV Y PROG.txt",
        },
        {
          concepto: "PAGO LUISITO",
          importeGs: null,
          origen: "pendiente",
          nota: "Fila LUISITO del cuadro",
        },
        {
          concepto: "PAGO A PROVEEDORES",
          importeGs: -280_266_115,
          origen: "manual",
        },
        {
          concepto: "GASTOS DE DESPACHO",
          importeGs: -115_000_000,
          origen: "manual",
        },
        {
          concepto: "PREVISION GASTOS OPERATIVOS",
          importeGs: -2_338_191_000,
          origen: "manual",
        },
        {
          concepto: "PRESTAMO BANCARIO",
          importeGs: -157_000_000,
          origen: "manual",
        },
      ],
      saldoDisponibleGs: null,
    },
    {
      mesYm: "2026-09",
      etiqueta: "SEPTIEMBRE 2026",
      lineas: [
        {
          concepto: "CHEQUES A VENCER",
          importeGs: 1_182_581_582,
          origen: "auto",
        },
        {
          concepto: "PV Y PROG A COBRAR",
          importeGs: 1_409_144_170,
          origen: "auto",
        },
        {
          concepto: "PAGOS DE BAZZAR",
          importeGs: 1_300_000_000,
          origen: "manual",
        },
      ],
      saldoDisponibleGs: null,
    },
  ],
};
