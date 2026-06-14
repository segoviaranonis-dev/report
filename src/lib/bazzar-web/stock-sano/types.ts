export type StockSanoRow = {
  almacen_id: number;
  almacen_nombre: string;
  combinacion_id: number;
  linea: string;
  referencia: string;
  material: string;
  color: string;
  talla: string;
  stock_pares: number;
  stock_sano_id: number | null;
  precio_venta: number | null;
  lpn: number | null;
  caso_codigo: string | null;
  markup_pct: number | null;
  estado_stock_sano: "SANO" | "SIN_PROTOCOLO" | "SIN_PRECIO";
  protocolo_activo: boolean | null;
};

export type StockSanoPayload = {
  configured: boolean;
  almacen: { id: number; nombre: string; protocolo_activo: boolean };
  metricas: {
    filas: number;
    pares: number;
    sano: number;
    sin_protocolo: number;
    tripletas: number;
  };
  filas: StockSanoRow[];
  historial: StockSanoHistorialRow[];
};

export type StockSanoHistorialRow = {
  id: number;
  evento: string;
  decision: string | null;
  linea_codigo: string;
  referencia_codigo: string;
  material: string | null;
  precio_anterior: number | null;
  precio_aplicado: number | null;
  lpn_entrante: number | null;
  caso_entrante: string | null;
  notas: string | null;
  created_at: string;
};
