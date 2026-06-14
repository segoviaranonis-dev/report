/** Tab activa — gemelo Streamlit `render_aprobacion()` */
export type TabAprobaciones = "pendientes" | "reservadas" | "confirmadas" | "anuladas";

export type FiEstado = "RESERVADA" | "CONFIRMADA" | "ANULADA" | string;

/** Cabecera FI — misma forma que logic.py get_fi_* / get_fis_de_pedido */
export type FiRecord = {
  id: number;
  nro_factura: string;
  pv_global: number | null;
  pp_id: number | null;
  pedido_id: number | null;
  marca: string;
  caso: string;
  estado: FiEstado;
  total_pares: number;
  total_monto: number;
  cliente_id: number | null;
  vendedor_id: number | null;
  plazo_id: number | null;
  plazo_nombre: string | null;
  lista_precio_id: number | null;
  descuento_1: number;
  descuento_2: number;
  descuento_3: number;
  descuento_4: number;
  cliente_nombre: string | null;
  vendedor_nombre: string | null;
  nro_pp: string | null;
  proforma: string | null;
  quincena_llegada: string | null;
  pp_estado: string | null;
  notas?: string | null;
  created_at?: string | null;
  /** RESERVADA→CONFIRMADA (MIG-114) */
  fecha_confirmacion?: string | null;
};

/** Pedido web pendiente — get_pedidos_pendientes() */
export type PedidoPendiente = {
  id: number;
  nro_pedido: string;
  cliente_id: number;
  cliente_nombre: string;
  vendedor_id: number | null;
  vendedor_nombre: string | null;
  plazo_id: number | null;
  plazo_nombre: string | null;
  lista_precio_id: number | null;
  descuento_1: number;
  descuento_2: number;
  descuento_3: number;
  descuento_4: number;
  total_pares: number;
  total_monto: number;
  created_at: string | null;
};

export type FiDetalle = {
  id: number;
  pares: number;
  cajas: number;
  precio_neto: number;
  subtotal: number;
  linea_codigo: string;
  ref_codigo: string;
  color_nombre: string;
  material_nombre: string;
  /** Texto canónico: gradas_fmt del snapshot o derivado de grades_json */
  gradas_display: string;
  /** Candidatos bucket productos (protocolo L-R-M-C) */
  imageCandidates: string[];
  imageSearchName: string | null;
};

export type AprobacionesData = {
  pendientes: PedidoPendiente[];
  reservadas: FiRecord[];
  confirmadas: FiRecord[];
  anuladas: FiRecord[];
  /** Items por factura_id — SSR batch (fotos + gradas siempre visibles) */
  detallesPorFi: Record<number, FiDetalle[]>;
};

export type MensajeFeedback = { tipo: "success" | "error"; texto: string };

export type CatalogoPlazo = { id: number; nombre: string };
export type CatalogoVendedor = { id: number; nombre: string };

export type AprobacionesCatalogos = {
  plazos: CatalogoPlazo[];
  vendedores: CatalogoVendedor[];
};
