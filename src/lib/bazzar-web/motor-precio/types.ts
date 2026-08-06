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
  descp_color: string | null;
  /**
   * Color Excel Kyly para stem 638 L_C (LEY 2.01.04.021).
   * Cadena: PE.color_code → F9 → PPD → nombre si token K/dígitos → codigo pilar.
   */
  imagen_color_excel: string | null;
  /** URL/stem PE real (paridad Depósito Web) — prioriza foto en thumb. */
  imagen_nombre: string | null;
  /** 1 calzado 654 · 2 confecciones 638 (desde linea.proveedor_id). */
  tipo_v2_id: number | null;
  tipo_v2: string | null;
  /** Dims cascada siamese (2.2.1.44 / 2.2.1.42) */
  linea_id: number | null;
  referencia_id: number | null;
  material_id: number | null;
  color_id: number | null;
  marca_id: number | null;
  genero_id: number | null;
  grupo_estilo_id: number | null;
  marca: string | null;
  genero: string | null;
  estilo: string | null;
  /** COD.GRUPO DPE del PE vivo — tipificación grupo uno */
  pe_cod_grupo: string | null;
  stock_pares: number;
  lpn: number | null;
  /** Etiqueta RIMEC: NORMAL | PROMOCIONAL | LIQUIDACION | COMUN | … */
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
