/**
 * Padrón Hiedra — TXT por programa_erp (Carlos), no por nombre de archivo.
 * Fuente: padron-programa-erp.json · MIG-205 sf_programa_erp
 */

import padron from "./padron-programa-erp.json";

export type EstadoConsumoPadron = "detectado" | "mapeado" | "integro" | "obsoleto";

export type ProgramaErpPadron = {
  programa_erp: string;
  tipo_codigo?: string | null;
  titulo_informe?: string;
  columnas_cabecera?: string[];
  filtros_tipicos?: Record<string, string>;
  parser_key?: string | null;
  estado_consumo: EstadoConsumoPadron | string;
  n_archivos_lab?: number;
  sit_fin_mol_keys?: string[];
  archivos_lab_ejemplo?: string[];
  notas?: string;
};

type PadronJson = {
  ley: string;
  programas: Record<string, ProgramaErpPadron>;
};

const DATA = padron as PadronJson;

/** Normaliza ifcqvg / ifcqvg$ → ifcqvg$ */
export function normalizarProgramaErp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let p = raw.trim().toLowerCase();
  if (!p) return null;
  if (p.startsWith("if") && !p.includes("$")) p = `${p}$`;
  return p;
}

export function lookupProgramaErp(
  raw: string | null | undefined
): ProgramaErpPadron | null {
  const key = normalizarProgramaErp(raw);
  if (!key) return null;
  return DATA.programas[key] || DATA.programas[key.replace(/\$$/, "")] || null;
}

export function programasIntegrados(): ProgramaErpPadron[] {
  return Object.values(DATA.programas).filter(
    (p) => p.estado_consumo === "integro"
  );
}

export const PADRON_LEY = DATA.ley;
export const PROGRAMA_CHEQUES_VENCER = "ifcqvg$";
