/**
 * Datos demo cuando no hay DATABASE_URL o staging vacío.
 */
import type { ColumnaStockRetail } from "@/lib/retail/types";

export type { TiendaTallaBloque, ImportadoraBloque, ColumnaStockRetail } from "@/lib/retail/types";

export const STOCK_BOARD_DEMO_COLUMNAS: ColumnaStockRetail[] = [
  {
    id: "l1143-r309-fernando",
    origenLabel: "Fernando — VENTA · STOCK",
    origenRaw: "Fernando",
    esImportadora: false,
    etiqueta: "L1143 R309 - 29 pares Otros (retail staging)",
    imagenClass: "bg-gradient-to-br from-violet-300 via-purple-500 to-indigo-950",
    imageSearchName: "1143-309-5881-47164.jpg",
    tiendas: [
      { nombre: "Fernando — VENTA · STOCK", tallas: ["38", "39"], venta: [5, 7], stock: [1, 4] },
    ],
    importadora: { etiquetaGrada: "—", stockTotal: 0 },
  },
  {
    id: "l1122-r828-san-martin",
    origenLabel: "San Martin — VENTA · STOCK",
    origenRaw: "San Martin",
    esImportadora: false,
    etiqueta: "L1122 R828 - 17 pares VIZZANO",
    imagenClass: "bg-gradient-to-br from-amber-100 via-amber-300 to-amber-900",
    imageSearchName: "1122-828-5881-68592.jpg",
    tiendas: [
      { nombre: "San Martin — VENTA · STOCK", tallas: ["34", "38"], venta: [null, 7], stock: [1, 1] },
    ],
    importadora: { etiquetaGrada: "—", stockTotal: 0 },
  },
  {
    id: "l1122-r828-rimec",
    origenLabel: "RIMEC — Stock Importadora",
    origenRaw: "Rimec",
    esImportadora: true,
    etiqueta: "L1122 R828 - 24 pares VIZZANO",
    imagenClass: "bg-gradient-to-br from-fuchsia-200 via-purple-600 to-slate-950",
    imageSearchName: "1122-828-5881-15745.jpg",
    tiendas: [],
    importadora: { etiquetaGrada: "34(1 2 3 3 2 1)39", stockTotal: 24 },
  },
];
