/** Hoja agregada: línea+ref+material+color por ente (sin grada — SUM cantidad). */
export type RetailArbolLeaf = {
  ente: string;
  genero: string;
  marca: string;
  skuKey: string;
  skuLabel: string;
  stock: number;
  venta: number;
};

export type RetailArbolNodo = {
  id: string;
  nivel: 1 | 2 | 3 | 4;
  nombre: string;
  count: number;
  stock: number;
  venta: number;
  total: number;
  hijos?: RetailArbolNodo[];
};

export type RetailArbolKpis = {
  stock: number;
  venta: number;
  total: number;
  skus: number;
  filasExcel: number;
};

export type RetailArbolSnapshotMeta = {
  archivoOrigen: string | null;
  cargadoEn: string | null;
};

export type RetailArbolSnapshotResponse = {
  configured: boolean;
  meta: RetailArbolSnapshotMeta;
  kpis: RetailArbolKpis;
  arbol: RetailArbolNodo[];
  error?: string;
};
