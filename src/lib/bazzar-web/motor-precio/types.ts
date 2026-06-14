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
  material: string;
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
