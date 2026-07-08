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
};
