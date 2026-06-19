export type DepositoSaldoRow = {
  ppd_id: number;
  marca: string;
  pedido: string;
  linea: string;
  referencia: string;
  material: string;
  color: string;
  grada: string;
  cantidad_inicial: number;
  vendido: number;
  saldo: number;
};

export type CompraDistribuida = {
  id: number;
  numero_registro: string;
  estado: string;
};

export type DepositoKpis = {
  filas: number;
  total_inicial: number;
  total_vendido: number;
  total_saldo: number;
};
