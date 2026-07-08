import type { OrigenStockCanon } from "./filters";

export type FacturaListItem = {
  factura: string;
  factura_legacy: string;
  fi_id: number | null;
  /** MIG-107 — display canónico PV000226 */
  pv_global: number | null;
  pp_id: number | null;
  pedido: string;
  proforma: string;
  marca: string;
  fecha: string | null;
  cliente: string;
  codigo_cliente: string;
  vendedor: string | null;
  lista_precio_id: number | null;
  descuento_1: number;
  descuento_2: number;
  descuento_3: number;
  descuento_4: number;
  pares: number;
  compra: string;
  compra_id: string;
  traspaso_estado: string;
  traspaso_id: number | null;
  /** PROCESO_PP (tránsito) | STOCK_IMPORTADO (PE) */
  origen_stock: OrigenStockCanon;
  /** Estado canónico factura_interna */
  fi_estado: string;
  total_monto: number | null;
};

export type FacturaKpis = {
  total: number;
  sin_traspaso: number;
  borrador: number;
  enviado: number;
  confirmado: number;
  total_pares: number;
  reservadas?: number;
  confirmadas_fi?: number;
};

/** Término único holding — UI y docs. */
export const TERMINO_FI = "Factura interna";

export const TERMINO_FI_ABREV = "FI";
