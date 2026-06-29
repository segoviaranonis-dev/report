/** Tipos compartidos import CSV — safe para client components */

import type { EnteBazzar } from "@/lib/depositos/bazzar-csv-ente-map";

export type ImportCsvMode = "replace" | "merge";

export type PilaresProvisionStats = {
  lineas: number;
  referencias: number;
  materiales: number;
  colores: number;
  linea_referencia: number;
  duracion_ms: number;
};

export type TablaImportResult = {
  tabla: string;
  cliente_id: number;
  deleted: number;
  inserted: number;
  updated: number;
  fk_miss: number;
  filas_csv: number;
  pilares?: PilaresProvisionStats;
  deposito_duracion_ms?: number;
};

export type ExpandStats = {
  skipped_parse: number;
  skipped_matriz: number;
  calzado: number;
  confecciones: number;
  matriz_reasons: Record<string, number>;
};

export type FileImportResult = {
  filename: string;
  ente: EnteBazzar;
  lote: string;
  ok: boolean;
  error?: string;
  tablas: TablaImportResult[];
  stats: ExpandStats;
};

export type ImportTiming = {
  total_ms: number;
  pilares_ms: number;
  deposito_ms: number;
};

export type ImportCsvBatchResult = {
  success: boolean;
  mode: ImportCsvMode;
  dry_run: boolean;
  files: FileImportResult[];
  duracion_ms: number;
  timing?: ImportTiming;
  error?: string;
};
