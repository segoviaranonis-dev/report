export type CompraLegalListItem = {
  id: number;
  numero_registro: string;
  proforma_referencia: string;
  fecha_factura: string | null;
  estado: string;
  pps_vinculados: string;
  total_pares: number;
  n_traspasos: number;
  n_confirmados: number;
};

export type CompraLegalHeader = {
  id: number;
  numero_registro: string;
  proforma: string;
  fecha_factura: string | null;
  estado: string;
  pps_vinculados: string;
  total_pares_f9: number;
  pares_facturados: number;
  pares_deposito: number;
};

export type PpDeCompra = {
  id: number;
  numero_registro: string;
  numero_proforma: string;
  estado: string;
  marcas: string;
  total_pares: number;
  total_vendido: number;
};

export type DepositoHijaRow = {
  marca: string;
  linea: string;
  referencia: string;
  material: string;
  color: string;
  cantidad_inicial: number;
  vendido: number;
  saldo: number;
};

export type FiDeCompraRow = {
  id: number;
  nro_factura: string;
  pv_global: number | null;
  estado: string;
  pp_id: number;
  nro_pp: string | null;
  marca: string;
  caso: string;
  cliente: string;
  vendedor: string;
  total_pares: number;
  total_monto: number;
  lista_precio_id: number | null;
  descuento_1: number;
  descuento_2: number;
  descuento_3: number;
  descuento_4: number;
  created_at: string | null;
};
