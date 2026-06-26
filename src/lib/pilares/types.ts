export type TipoV2Id = 1 | 2;

export interface LineaRow {
  id: number;
  codigo_proveedor: string;
  descripcion: string | null;
  marca_id: number | null;
  marca: string;
  genero_id: number | null;
  descp_genero: string;
}

export interface LineaReferenciaThumb {
  imagen_nombre: string | null;
  material_code: string;
  color_code: string;
}

export interface LineaReferenciaRow {
  id: number;
  proveedor_id: number;
  proveedor_cod: string;
  linea_id: number;
  linea_codigo: string;
  referencia_codigo: string;
  marca: string;
  descp_grupo_estilo: string;
  descp_tipo_1: string;
  grupo_estilo_id: number | null;
  tipo_1_id: number | null;
  /** Primera imagen retail con coincidencia exacta L×R (staging). */
  thumb?: LineaReferenciaThumb | null;
}

export interface PilaresMaestras {
  marcas: { id: number; label: string }[];
  generos: { id: number; label: string }[];
  estilos: { id: number; label: string }[];
  tipos1: { id: number; label: string }[];
}

export interface LineasResumenMarca {
  marca: string;
  lineas: number;
}

export interface LineasResumenGenero {
  genero: string;
  lineas: number;
}

export interface LineasResumenGeneroPorMarca {
  marca: string;
  genero: string;
  lineas: number;
}

export interface LineasResumen {
  total: number;
  sin_marca: number;
  sin_genero: number;
  marcas_distintas: number;
  generos_distintos: number;
  por_marca: LineasResumenMarca[];
  por_genero: LineasResumenGenero[];
  genero_por_marca: LineasResumenGeneroPorMarca[];
}

export interface LrCascadaItem {
  key: string;
  label: string;
  count: number;
}

export interface LineaReferenciaCascada {
  marcas: LrCascadaItem[];
  estilos: LrCascadaItem[];
  tipos1: LrCascadaItem[];
  lineas: LrCascadaItem[];
}

export type LineaReferenciaFilterOpts = {
  marca?: string | null;
  estiloId?: number | null;
  tipo1Id?: number | null;
  estiloNull?: boolean;
  tipo1Null?: boolean;
  lineaCodigos?: string[] | null;
};

export interface ColorRow {
  id: number;
  codigo_proveedor: string;
  nombre: string | null;
  tono_canon: Record<string, unknown> | null;
  predominante: string;
}

export interface ColoresResumen {
  total: number;
  sin_tono: number;
  con_tono: number;
  sin_nombre: number;
  con_nombre: number;
  por_etiqueta: { etiqueta: string; count: number }[];
}
