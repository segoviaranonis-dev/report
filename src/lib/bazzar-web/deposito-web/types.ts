export type DepositoResumenRow = {
  marca: string;
  linea: string;
  referencia: string;
  material: string;
  color: string;
  stock_total: number;
};

export type DepositoStockRow = {
  marca: string;
  linea: string;
  referencia: string;
  material: string;
  color: string;
  talla: string;
  stock: number;
};

export type DepositoWebPayload = {
  configured: boolean;
  resumen: DepositoResumenRow[];
  detalle: DepositoStockRow[];
  metricas: {
    articulos: number;
    pares: number;
  };
};

export type PivotRow = {
  linea: string;
  referencia: string;
  material: string;
  color: string;
  tallas: Record<string, number>;
};
