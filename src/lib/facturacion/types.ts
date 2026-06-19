export type FacturaListItem = {
  factura: string;
  factura_legacy: string;
  pedido: string;
  proforma: string;
  marca: string;
  fecha: string | null;
  cliente: string;
  codigo_cliente: string;
  pares: number;
  compra: string;
  compra_id: string;
  traspaso_estado: string;
  traspaso_id: number | null;
};

export type FacturaKpis = {
  total: number;
  sin_traspaso: number;
  borrador: number;
  enviado: number;
  confirmado: number;
  total_pares: number;
};
