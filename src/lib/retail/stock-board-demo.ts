/**
 * Datos demo cuando no hay DATABASE_URL o staging vacío.
 * Tipos compartidos en `types.ts`; la UI viva lee `/api/retail/stock-board`.
 */
import type { ColumnaStockRetail } from "@/lib/retail/types";

export type { TiendaTallaBloque, ImportadoraBloque, ColumnaStockRetail } from "@/lib/retail/types";

export const STOCK_BOARD_DEMO_COLUMNAS: ColumnaStockRetail[] = [
  {
    id: "l1143-r309-29",
    etiqueta: "L1143 R309 - 29 pares Otros (retail staging)",
    imagenClass: "bg-gradient-to-br from-violet-300 via-purple-500 to-indigo-950",
    imageSearchName: "1143-309-5881-47164.jpg",
    tiendas: [
      { nombre: "Tienda_1", tallas: ["38", "39"], venta: [5, 7], stock: [1, 4] },
      { nombre: "Tienda_2", tallas: ["38", "39"], venta: [1, 1], stock: [9, 7] },
      { nombre: "Tienda_3", tallas: ["38", "39"], venta: [8, 7], stock: [14, 3] },
    ],
    importadora: { etiquetaGrada: "34(1 2 3 3 2 1)39", stockTotal: 36 },
  },
  {
    id: "l1122-r828-17",
    etiqueta: "L1122 R828 - 17 pares VIZZANO",
    imagenClass: "bg-gradient-to-br from-amber-100 via-amber-300 to-amber-900",
    imageSearchName: "1122-828-5881-68592.jpg",
    tiendas: [
      { nombre: "Tienda_1", tallas: ["34", "38"], venta: [null, 7], stock: [1, 1] },
      { nombre: "Tienda_2", tallas: ["34", "38"], venta: [null, 1], stock: [12, 8] },
      { nombre: "Tienda_3", tallas: ["34", "38"], venta: [null, 9], stock: [7, 9] },
    ],
    importadora: { etiquetaGrada: "34(1 2 3 3 2 1)39", stockTotal: 24 },
  },
  {
    id: "l1143-r309-15",
    etiqueta: "L1143 R309 - 15 pares Otros (retail staging)",
    imagenClass: "bg-gradient-to-br from-fuchsia-200 via-purple-600 to-slate-950",
    imageSearchName: "1143-309-5881-15745.jpg",
    tiendas: [
      { nombre: "Tienda_1", tallas: ["34"], venta: [null], stock: [14] },
      { nombre: "Tienda_2", tallas: ["34"], venta: [3], stock: [10] },
      { nombre: "Tienda_3", tallas: ["34"], venta: [12], stock: [1] },
    ],
    importadora: { etiquetaGrada: "34(1 2 3 3 2 1)39", stockTotal: 12 },
  },
];
