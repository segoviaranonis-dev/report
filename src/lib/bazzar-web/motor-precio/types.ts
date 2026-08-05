export type ReglaMarkup = {
  id: number;
  caso_codigo: string;
  markup_pct: number;
  descripcion: string | null;
  activo: boolean;
  updated_at: string | null;
};

export type CatalogoPrecioRow = {
  linea: string;
  referencia: string;
  /** Descripción material (UI). */
  material: string;
  /** Código proveedor material — naming imagen 654 L-R-M-C. */
  material_codigo: string | null;
  /** Color representante con stock — naming imagen 654. */
  color_codigo: string | null;
  /** Color Excel Kyly (col.nombre) — stem 638 L_C. */
  imagen_color_excel: string | null;
  /** 1 calzado 654 · 2 confecciones 638 (desde linea.proveedor_id). */
  tipo_v2_id: number | null;
  stock_pares: number;
  lpn: number | null;
  caso_precio: string | null;
  markup_pct: number | null;
  precio_rimec_lpn: number | null;
  precio_web_calculado: number | null;
  precio_web_publicado: number | null;
  combinaciones: number;
  sin_precio: boolean;
};

export type SimularPrecioResult = {
  lpn: number;
  caso: string;
  markup_pct: number | null;
  precio_web: number | null;
};

export type PublicarPrecioResult = {
  ok: boolean;
  publicados: number;
  omitidos: number;
  error?: string;
};
