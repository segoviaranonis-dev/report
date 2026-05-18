/** Bloque Tienda_n: venta/stock por talla (grada simple). */
export type TiendaTallaBloque = {
  nombre: string;
  tallas: string[];
  /** Misma longitud que `tallas`; null = sin venta en esa talla (UI muestra —). */
  venta: (number | null)[];
  stock: number[];
};

export type ImportadoraBloque = {
  etiquetaGrada: string;
  stockTotal: number;
};

/** Una columna del tablero (SKU / línea+ref+mat+color). */
export type ColumnaStockRetail = {
  id: string;
  etiqueta: string;
  imagenClass: string;
  imageSrc?: string;
  /** URLs a probar en orden (jpg → jpeg → png → L-R). */
  imageCandidates?: string[];
  /** Nombre de archivo en bucket `productos` que se intenta cargar (para mostrar si falla). */
  imageSearchName?: string | null;
  tiendas: TiendaTallaBloque[];
  importadora: ImportadoraBloque;
};

export type RetailBatchSummary = {
  batchId: string;
  batchLabel: string;
  archivoOrigen: string;
  fechaMin: string | null;
  fechaMax: string | null;
  filas: number;
  cargadoEn: string | null;
};

export type RetailStockBoardKpis = {
  paresEnRed: number;
  referenciasActivas: number;
  paresImportadora: number;
  paresVentaTotal: number;
  filasStaging: number;
  filasPilaresOk: number;
  filasPilaresPendientes: number;
};

export type RetailPilaresResumen = {
  /** Filas del lote con linea_id + referencia_id + material + color resueltos. */
  filasOk: number;
  filasPendientes: number;
  mensaje: string;
};

export type RetailStockBoardResponse = {
  configured: boolean;
  batchId: string | null;
  batchLabel: string | null;
  columnas: ColumnaStockRetail[];
  kpis: RetailStockBoardKpis;
  pilares: RetailPilaresResumen;
  error?: string;
};

export type RetailMetaResponse = {
  configured: boolean;
  batches: RetailBatchSummary[];
  error?: string;
};
