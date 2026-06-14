export type TraspasoListItem = {
  id: number;
  numero_registro: string;
  fecha_traspaso: string | null;
  estado: string;
  factura: string;
  compra: string;
  pares_detalle: number;
};

export type TraspasoDetail = {
  id: number;
  numero_registro: string;
  fecha_traspaso: string | null;
  estado: string;
  factura: string;
  compra: string;
  snapshot: Record<string, unknown>;
};

export type TraspasoDetalleLine = {
  id: number | null;
  combinacion_id: number | null;
  linea: string;
  referencia: string;
  material: string;
  color: string;
  talla: string;
  cantidad: number;
  caso_nombre: string;
  precio?: number | null;
};

export type FiRegistroRow = {
  id: number;
  nro_factura: string;
  pv_global: number | null;
  estado: string;
  pp_id: number | null;
  nro_pp: string | null;
  marca: string | null;
  caso: string | null;
  cliente: string | null;
  vendedor: string | null;
  total_pares: number;
  total_monto: number;
  lista_precio_id: number | null;
  descuento_1: number;
  descuento_2: number;
  descuento_3: number;
  descuento_4: number;
  created_at: string | null;
};

export type FiDetalleCanonico = {
  id: number;
  pares: number;
  cajas: number;
  precio_unit: number | null;
  subtotal: number | null;
  precio_neto: number | null;
  linea_snapshot: Record<string, unknown>;
};

export type FacturaLineaLegacy = {
  linea: string;
  referencia: string;
  material: string;
  color: string;
  grada: string | null;
  t33: number;
  t34: number;
  t35: number;
  t36: number;
  t37: number;
  t38: number;
  t39: number;
  t40: number;
  pares: number;
};
