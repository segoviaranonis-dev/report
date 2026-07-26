/** Tipos Ala Norte — safe client + server (sin pg). */
export type PpAlaNorteRow = {
  id: number;
  marca: string;
  linea: string;
  referencia: string;
  style_code: string | null;
  material_code: string | null;
  material: string;
  color_code: string | null;
  color: string;
  grada: string | null;
  grades_json: unknown;
  cantidad_cajas: number;
  cantidad_inicial: number;
  vendido: number;
  saldo: number;
  /** LPN vinculado (PPD) — único origen de precio de venta en tránsito CP. */
  precio_lpn: number | null;
  precio_lpc03: number | null;
  /** Tipo de cambio del listado al vincular. */
  precio_dolar_origen: number | null;
  /** Caso comercial snapshot al vincular listado. */
  caso: string | null;
  listado_evento_id: number | null;
};
