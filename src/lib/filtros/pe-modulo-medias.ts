/**
 * Módulo MEDIAS PE — calzado · COD.GRUPO d23=04 · marcas *MEDIA*.
 * Excel Tipo1 «ACCESORIOS» en calzado = MEDIAS (no ACT ROPAS).
 */
import { decodeCodGrupo } from "@/lib/pilares/cod-grupo-decode";
import { normLabel } from "@/lib/pilares/sdrm-pilares-map";

export const PE_TIPO1_MEDIAS_ID = 4;

/** Marcas canónicas Stock valorizado 07-07-26 (61 SKUs · 17 moléculas). */
export const PE_MEDIAS_MARCAS_VALORIZADO = [
  "ACTVITTA MEDIA FEM",
  "ACTVITTA MEDIA MASC",
  "MOLEKINHA MEDIAS",
  "MOLEKINHO MEDIAS",
  "MOLECA MEDIAS",
  "MODARE MEDIAS",
] as const;

/** Líneas recurrentes medias (Excel). */
export const PE_MEDIAS_LINEAS_VALORIZADO = [
  "2199",
  "2598",
  "2599",
  "2799",
  "2899",
  "4998",
  "4999",
  "5999",
  "7499",
] as const;

export type FilaMediasSignals = {
  tipo_1?: string | null;
  descp_tipo_1?: string | null;
  tipo_v2?: string | null;
  marca?: string | null;
  sdrm_marca?: string | null;
  cod_grupo?: string | null;
  linea_codigo_proveedor?: string | number | null;
};

export function codGrupoEsMedias(cod_grupo: string | null | undefined): boolean {
  const dec = decodeCodGrupo(cod_grupo);
  if (!dec.ok) return false;
  return dec.tipo1Label === "MEDIAS";
}

export function esMarcaMedias(raw: string | null | undefined): boolean {
  const u = normLabel(raw);
  if (!u) return false;
  if (/\bMEDIAS?\b/.test(u)) return true;
  return PE_MEDIAS_MARCAS_VALORIZADO.some((m) => u.includes(normLabel(m)));
}

export function esLabelMedias(raw: string | null | undefined): boolean {
  return normLabel(raw) === "MEDIAS";
}

export function esFilaMedias(row: FilaMediasSignals): boolean {
  if (esLabelMedias(row.tipo_1) || esLabelMedias(row.descp_tipo_1)) return true;
  if (codGrupoEsMedias(row.cod_grupo)) return true;
  if (esMarcaMedias(row.marca) || esMarcaMedias(row.sdrm_marca)) return true;
  const linea = String(row.linea_codigo_proveedor ?? "").trim();
  if (linea && (PE_MEDIAS_LINEAS_VALORIZADO as readonly string[]).includes(linea)) {
    return true;
  }
  return false;
}

export function rowMatchesMediasTipo1(row: FilaMediasSignals, tipo1Id: number | null | undefined): boolean {
  if (Number(tipo1Id) === PE_TIPO1_MEDIAS_ID) return esFilaMedias(row);
  return false;
}

export const ABCR_MEDIAS_ITEM = { id: PE_TIPO1_MEDIAS_ID, label: "MEDIAS" } as const;
