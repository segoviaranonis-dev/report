/** Auditoría integridad stock Bazzar Web — ALM_WEB_01 */

export type CheckEstado = "PASS" | "WARN" | "FAIL" | "INFO";

export type AuditoriaCheck = {
  id: string;
  label: string;
  estado: CheckEstado;
  detalle: string;
  valor?: string | number | null;
};

export type AuditoriaStockPayload = {
  ok: boolean;
  generado_en: string;
  almacen_id: number;
  protocolo_activo: boolean;
  lista_precio_id: number | null;
  metricas: {
    modelos_sano: number;
    filas_vendibles: number;
    pares_vendibles: number;
    filas_stock_positivo: number;
    pares_stock_positivo: number;
    sin_sano: number;
    sin_precio: number;
    calzado_654: number;
    confecciones_638: number;
    stock_sano_deposito_n: number;
  };
  checks: AuditoriaCheck[];
};

export type SiamesesChecklistItem = {
  id: string;
  label: string;
  estado: CheckEstado;
  detalle: string;
  ruta?: string;
};

export type SiamesesPayload = {
  pareja: {
    a: { nombre: string; app: string; ruta: string };
    b: { nombre: string; app: string; ruta: string };
  };
  prioridad: string[];
  ley: string;
  items: SiamesesChecklistItem[];
  modulos_canonicos: { label: string; path: string }[];
};

export type EstadisticaDimRow = {
  clave: string;
  deposito_modelos: number;
  deposito_pares: number;
  sano_modelos: number;
  sano_pares: number;
  web_modelos: number;
  web_pares: number;
  delta_modelos_web_dep: number;
  delta_pares_web_dep: number;
  estado: CheckEstado;
};

export type EstadisticaHueco = {
  linea: string;
  referencia: string;
  material: string;
  marca: string;
  estilo: string;
  tipo_v2: string;
  deposito_pares: number;
  sano_pares: number | null;
  web_pares: number | null;
  problema: "sin_web" | "sin_sano" | "solo_deposito" | "pares_diff";
};

export type EstadisticaTotales = {
  deposito_modelos: number;
  deposito_pares: number;
  sano_modelos: number;
  sano_pares: number;
  web_modelos: number;
  web_pares: number;
};

export type EstadisticaPayload = {
  ok: boolean;
  generado_en: string;
  totales: EstadisticaTotales;
  por_tipo_v2: EstadisticaDimRow[];
  por_marca: EstadisticaDimRow[];
  por_estilo: EstadisticaDimRow[];
  huecos: EstadisticaHueco[];
};

export type AuditoriaIntegridadPayload = {
  stock: AuditoriaStockPayload;
  siameses: SiamesesPayload;
  estadistica: EstadisticaPayload;
};
