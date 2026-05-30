export type VentaFotoTipo = "VENTA" | "TRANSITO" | "DESCONOCIDO";

export type VentasFotosMarca = {
  id_marca: number;
  descp_marca: string;
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
  descp_categoria: string | null;
  // Pilares parseados desde imagen (formato L-R-M-C)
  linea_codigo: number | null;
  referencia_codigo: number | null;
  material_codigo: number | null;
  color_codigo: number | null;
  imagen_valid: boolean;
  imagen_error: string | null;
  image_url: string;
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
  columnasDetectadas: string[];
  message?: string;
  error?: string;
};
