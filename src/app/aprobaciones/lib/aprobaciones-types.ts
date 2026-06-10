export type PedidoEstado = "PENDIENTE" | "APROBADO" | "RECHAZADO";

export type FiltroEstado = "TODOS" | PedidoEstado;

export type Pedido = {
  id: number;
  nro_pedido: string;
  fecha: string;
  vendedor: string;
  cliente: string;
  total: number;
  items_count: number;
  estado: PedidoEstado;
  descuento_porcentaje: number;
  plazo: string;
  lista_precio: string;
};

export type Factura = {
  id: number;
  nro_factura: string;
  nro_factura_legacy?: string | null;
  pp_id: number;
  nro_pp: string;
  fecha_arribo_estimada: string | null;
  marca: string;
  caso: string;
  total_pares: number;
  total_monto: number;
  estado: string;
  lista_precio_id: number | null;
  descuento_1: number;
  descuento_2: number;
  descuento_3: number;
  descuento_4: number;
};

export type Item = {
  id: number;
  pares: number;
  cajas: number;
  precio_neto: number;
  subtotal: number;
  linea_codigo: string;
  ref_codigo: string;
  color_nombre: string;
  material_nombre: string;
  gradas_fmt: string;
  imagen_url: string;
};

export type DescuentosFactura = { d1: number; d2: number; d3: number; d4: number };

export type MensajeFeedback = { tipo: "success" | "error"; texto: string };

export const ADMIN_ID = 1;

export const PEDIDOS_POR_PAGINA = 10;
