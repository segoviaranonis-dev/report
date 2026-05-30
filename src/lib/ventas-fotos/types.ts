export type VentaFotoTipo = "VENTA" | "TRANSITO" | "DESCONOCIDO";

export type VentasFotosMarca = {
  id_marca: number;
  descp_marca: string;
  id_tipo?: number;
  descp_tipo?: string;
};

export type VentasFotosMetaResponse = {
  configured: boolean;
  marcas: VentasFotosMarca[];
  message?: string;
};

export type VentasFotosFilters = {
  clienteCodigo: string;
  fechaInicio: string;
  fechaFin: string;
  marcaId: number;
  referenciaPrefix?: string;
};

export type VentaFotoRow = {
  id_cliente: string;
  descp_cliente: string;
  fecha: string;
  cantidad: number;
  monto: number;
  preventa: number | string | null;
  tipo_venta: VentaFotoTipo;
  descp_marca: string;
  imagen: string;
  id_tipo: number | null;
  desc_tipo: string;
  id_categoria: number | null;
  descp_categoria: string;
  linea_codigo: string | null;
  referencia_codigo: string | null;
  material_code: string | null;
  color_code: string | null;
  molecule_valid: boolean;
  image_candidates: string[];
  image_search_name: string | null;
};

export type VentasFotosKpis = {
  total_cantidad: number;
  total_monto: number;
  total_ventas: number;
  total_transito: number;
  articulos_unicos: number;
};

export type VentasFotosResponse = {
  configured: boolean;
  rows: VentaFotoRow[];
  kpis: VentasFotosKpis;
  cliente: { id: string; nombre: string } | null;
  marca: VentasFotosMarca | null;
  tipo: { id: number; nombre: string };
  columnasDetectadas: string[];
  message?: string;
  error?: string;
};
