/** Tipos catálogo IC — sin dependencias server (safe para client bundle). */

export type IcCatalogos = {
  tipos: { id: number; label: string }[];
  categorias: { id: number; label: string; raw: string }[];
  marcas: { id: number; label: string }[];
  /** Marcas por división (tipo_v2). */
  marcasPorTipo: Record<number, { id: number; label: string }[]>;
  proveedores: { id: number; label: string }[];
  vendedores: { id: number; label: string }[];
  plazos: { id: number | null; label: string }[];
  eventos: { id: number | null; label: string; total_skus?: number }[];
  comisiones: { id: number; label: string; porcentaje: number }[];
};

export type LineaConCaso = {
  id: number;
  codigo_proveedor: number;
  descripcion: string | null;
  caso_nombre: string | null;
};
