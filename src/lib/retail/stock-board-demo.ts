/**
 * Datos demo cuando no hay DATABASE_URL o staging vacío.
 */
import type { ColumnaStockRetail } from "@/lib/retail/types";

export type { TiendaTallaBloque, ImportadoraBloque, ColumnaStockRetail } from "@/lib/retail/types";

export const STOCK_BOARD_DEMO_COLUMNAS: ColumnaStockRetail[] = [
  {
    id: "4202-500-26598-15787",
    imagenArchivo: "4202-500-26598-15787.jpg",
    totalVenta: 37,
    ranking: 1,
    ventaPorTienda: [
      { tienda: "Fernando", pares: 25 },
      { tienda: "Palma", pares: 10 },
      { tienda: "San Martin", pares: 2 },
    ],
    origenLabel: "VENTA",
    origenRaw: "",
    esImportadora: false,
    etiqueta: "L4202 R500 - 37 pares venta Otros",
    imagenClass: "bg-gradient-to-br from-violet-300 via-purple-500 to-indigo-950",
    imageSearchName: "4202-500-26598-15787.jpg",
    tiendas: [
      { nombre: "Fernando", tallas: ["38", "39"], venta: [5, 7], stock: [1, 4] },
      { nombre: "Palma", tallas: ["38"], venta: [10], stock: [2] },
    ],
    importadora: { etiquetaGrada: "—", stockTotal: 0 },
  },
  {
    id: "3105-105-20081-15745",
    imagenArchivo: "3105-105-20081-15745.jpg",
    totalVenta: 19,
    ranking: 2,
    ventaPorTienda: [{ tienda: "Fernando", pares: 19 }],
    origenLabel: "VENTA",
    origenRaw: "",
    esImportadora: false,
    etiqueta: "L3105 R105 - 19 pares venta VIZZANO",
    imagenClass: "bg-gradient-to-br from-amber-100 via-amber-300 to-amber-900",
    imageSearchName: "3105-105-20081-15745.jpg",
    tiendas: [{ nombre: "Fernando", tallas: ["37"], venta: [19], stock: [0] }],
    importadora: { etiquetaGrada: "—", stockTotal: 0 },
  },
  {
    id: "1122-828-rimec",
    imagenArchivo: "1122-828-5881-15745.jpg",
    totalVenta: 0,
    ranking: 3,
    ventaPorTienda: [],
    origenLabel: "VENTA",
    origenRaw: "",
    esImportadora: false,
    etiqueta: "L1122 R828 - 0 pares venta VIZZANO",
    imagenClass: "bg-gradient-to-br from-fuchsia-200 via-purple-600 to-slate-950",
    imageSearchName: "1122-828-5881-15745.jpg",
    tiendas: [],
    importadora: { etiquetaGrada: "34(1 2 3 3 2 1)39", stockTotal: 24 },
  },
];
