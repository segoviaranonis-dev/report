export type BobedaVentaRow = {
  codigo_oro: string;
  bandeja_codigo: string | null;
  cliente_id: number;
  tienda_label: string;
  deposito_tabla: string;
  estado: string;
  origen: string;
  fecha_venta: string;
  created_at: string;
  entregado_at: string | null;
  staging_id: number | null;
  import_batch_id: string | null;
  numero_fi_fa: number | null;
  numero_factura_legal: string | null;
  marca: string;
  vendedor_nombre: string | null;
  vendedor_bazzar_id: number | null;
  cedula_cliente: string | null;
  nombre_cliente: string;
  linea_id: number;
  referencia_id: number;
  material_id: number;
  color_id: number;
  linea_codigo: string | null;
  referencia_codigo: string | null;
  material_code: string | null;
  color_code: string | null;
  descp_material: string | null;
  descp_color: string | null;
  grada: string;
  precio_unitario: number | null;
  /** Excel / lote retail congelado en snapshot si existe */
  trazabilidad_excel: string | null;
  trazabilidad_batch: string | null;
  import_fecha: string | null;
  controlado: boolean | null;
};

export type BobedaVentasQuery = {
  clienteId?: number;
  estado?: string;
  origen?: string;
  desde?: string;
  hasta?: string;
  marca?: string;
  vendedor?: string;
  cedula?: string;
  facturaLegal?: string;
  fiFa?: number;
  stagingId?: number;
  q?: string;
  limit: number;
  offset: number;
  allowedClienteIds?: number[];
};

export type BobedaVentasResponse = {
  configured: boolean;
  rows: BobedaVentaRow[];
  total: number;
  pares: number;
  monto_total: number;
  error?: string;
};

export type BobedaFiltrosResponse = {
  configured: boolean;
  tiendas: { cliente_id: number; label: string; deposito_tabla: string }[];
  estados: string[];
  origenes: string[];
  marcas: string[];
  vendedores: string[];
  error?: string;
};
