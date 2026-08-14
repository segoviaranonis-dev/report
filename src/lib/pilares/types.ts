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
  /** FOCO 2.3.5.5 — cola problemas estilo */
  es_problema_estilo?: boolean;
  tiene_imagen?: boolean;
  problema_estilo_kind?: "SIN_ESTILO" | "OTROS" | null;
  estilo_sugerido_id?: number | null;
  estilo_sugerido_label?: string | null;
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
  generos: LrCascadaItem[];
  marcas: LrCascadaItem[];
  estilos: LrCascadaItem[];
  tipos1: LrCascadaItem[];
  lineas: LrCascadaItem[];
  referencias: LrCascadaItem[];
  materiales: LrCascadaItem[];
  colores: LrCascadaItem[];
}

export type LineaReferenciaFilterOpts = {
  /** legacy single label */
  marca?: string | null;
  /** multi OR · siames W */
  marcaIds?: number[] | null;
  marcaNull?: boolean;
  generoId?: number | null;
  generoIds?: number[] | null;
  generoNull?: boolean;
  estiloId?: number | null;
  estiloIds?: number[] | null;
  tipo1Id?: number | null;
  tipo1Ids?: number[] | null;
  estiloNull?: boolean;
  tipo1Null?: boolean;
  lineaCodigos?: string[] | null;
  lineaIds?: number[] | null;
  referenciaIds?: number[] | null;
  buscar?: string | null;
  materialFamilias?: string[] | null;
  colorFamilias?: string[] | null;
  origenTipo?: "TODOS" | "CP" | "PRONTA_ENTREGA" | null;
  depositoCodigo?: string | null;
  tipoGrupos?: string[] | null;
  /** Sin estilo ∪ etiqueta OTROS */
  problemasEstilo?: boolean;
  /** true = con imagen_nombre retail · false = sin · null = no filtrar */
  conImagen?: boolean | null;
};

export type LineaReferenciaProblemasEstiloResumen = {
  total: number;
  con_imagen: number;
  sin_imagen: number;
};

/** Preview retail: 1ª fila con imagen para el código de color exacto (654 L-R-M-C). */
export interface ColorThumb {
  linea_codigo: string;
  referencia_codigo: string;
  material_code: string;
  color_code: string;
  imagen_nombre: string | null;
}

export interface ColorRow {
  id: number;
  codigo_proveedor: string;
  nombre: string | null;
  tono_canon: Record<string, unknown> | null;
  predominante: string;
  /** Miniatura opcional · ayuda a asignar tono_canon */
  thumb?: ColorThumb | null;
}

export interface ColoresResumen {
  total: number;
  sin_tono: number;
  con_tono: number;
  sin_nombre: number;
  con_nombre: number;
  por_etiqueta: { etiqueta: string; count: number }[];
}
