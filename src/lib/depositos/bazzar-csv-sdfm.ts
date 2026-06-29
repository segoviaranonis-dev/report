/**
 * CSV stock Bazzar (formato sdfm####) → depósitos Report.
 * Fernando: columnas S00_D1 · S00_D2 · S00_NINHOS en un solo archivo.
 *
 * Calzado (654 / tipo_v2=1) y confecciones (638 / tipo_v2=2) — ramas independientes.
 * Índice numérico: ver pilar-proveedor-index.ts
 */

import type { CategoriaDeposito } from "./depositos-config";
import {
  buildDepositMapForEnte,
  FERNANDO_SDFM_DEPOSIT_MAP,
  type BazzarCsvEnteTarget,
  type CsvStockColumn,
  type EnteBazzar,
} from "./bazzar-csv-ente-map";
import {
  classifyRamo,
  resolvePilaresCodigos,
  type PilaresCodigosResueltos,
  type RamoProveedor,
} from "./pilar-proveedor-index";

export type { PilaresCodigosResueltos, RamoProveedor };
export {
  classifyRamo,
  resolvePilaresCodigos,
  PROVEEDOR_CALZADO,
  PROVEEDOR_CONFECCIONES,
  TIPO_V2_CALZADO,
  TIPO_V2_CONFECCIONES,
} from "./pilar-proveedor-index";

export type BazzarCsvSdfmRow = {
  codigo_barras: string;
  cod_art_proveedor: string;
  cod_grupo: string;
  cod_material: string;
  cod_color: string;
  descripcion_grada: string;
  lpn: string;
  s00_d1: number;
  s00_d2: number;
  s00_ninhos: number;
};

export type BazzarCsvDepositoTarget = BazzarCsvEnteTarget;
export {
  buildDepositMapForEnte,
  parseBazzarCsvFilename,
  CSV_FILENAME_REGEX,
  ENTe_CLIENTE_IDS,
  PALMA_TIENDA_UNICA,
  type EnteBazzar,
  type CsvStockColumn,
  type SegmentoMarca,
} from "./bazzar-csv-ente-map";

/** Mapeo canónico Fernando · alias histórico. */
export { FERNANDO_SDFM_DEPOSIT_MAP };

/** COD.GRUPO → marcas típicas (referencia operador · validación matriz usa id_marca). */
export const GRUPO_MARCA_HINT: Record<string, string> = {
  "01": "VIZZANO + BEIRA RIO",
  "02": "VIZZANO",
  "03": "MODARE",
  "04": "MOLECA",
  "05": "MOLEKINHO + MOLEKINHA",
  "06": "MOLEKINHO",
  "07": "ACTVITTA",
  "08": "BR SPORT",
  "10": "KYLY",
  "11": "MILON",
  "12": "AMORA",
  "13": "LEMON",
  "14": "NANAI",
  "15": "PIPA",
};

export function parseLineaReferencia(codArtProveedor: string): { linea: string; referencia: string } {
  const t = codArtProveedor.trim();
  const i = t.indexOf("-");
  if (i === -1) return { linea: t, referencia: "" };
  return { linea: t.slice(0, i).trim(), referencia: t.slice(i + 1).trim() };
}

/** `Nø35` · `N°36` → talla/grada numérica. */
export function parseGradaFromDescripcion(raw: string): string {
  const m = String(raw ?? "").match(/(\d{2})/);
  return m ? m[1] : String(raw ?? "").trim();
}

export function parseLpn(raw: string): number | null {
  const n = Number(String(raw ?? "").replace(/\D/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n >= 1000 ? n / 1000 : n;
}

function qty(raw: string | undefined): number {
  const n = Number(String(raw ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

/** Normaliza fila DictReader (headers con espacios). */
export function normalizeSdfmCsvRecord(raw: Record<string, string>): BazzarCsvSdfmRow {
  const g = (k: string) => (raw[k] ?? raw[k.trim()] ?? "").trim();
  return {
    codigo_barras: g("CODIGO ARTICULO"),
    cod_art_proveedor: g("COD.ART.PROVEEDOR"),
    cod_grupo: g("COD.GRUPO") || g("GRUPO"),
    cod_material: g("COD.MATERIAL"),
    cod_color: g("COD.COLOR"),
    descripcion_grada: g("DESCRIPCION GRADA"),
    lpn: g("LPN"),
    s00_d1: qty(g("S00_D1")),
    s00_d2: qty(g("S00_D2")),
    s00_ninhos: qty(g("S00_NINHOS")),
  };
}

export type BazzarCsvDepositoLine = {
  target: BazzarCsvDepositoTarget;
  codigo_barras: string;
  cod_grupo: string;
  grada: string;
  cantidad: number;
  precio_unitario: number | null;
  pilares: PilaresCodigosResueltos;
};

export function expandSdfmRowToDepositLines(
  row: BazzarCsvSdfmRow,
  ente: EnteBazzar = "Fernando",
): BazzarCsvDepositoLine[] {
  const pilares = resolvePilaresCodigos({
    cod_art_proveedor: row.cod_art_proveedor,
    cod_grupo: row.cod_grupo,
    cod_material: row.cod_material,
    cod_color: row.cod_color,
  });
  if (!pilares) return [];

  const grada = parseGradaFromDescripcion(row.descripcion_grada);
  const precio = parseLpn(row.lpn);
  const base = {
    codigo_barras: row.codigo_barras,
    cod_grupo: row.cod_grupo,
    grada,
    precio_unitario: precio,
    pilares,
  };

  const out: BazzarCsvDepositoLine[] = [];
  const depositMap = buildDepositMapForEnte(ente);
  for (const target of depositMap) {
    const key =
      target.csvColumn === "S00_D1"
        ? "s00_d1"
        : target.csvColumn === "S00_D2"
          ? "s00_d2"
          : "s00_ninhos";
    const cantidad = row[key];
    if (cantidad <= 0) continue;
    out.push({ target, ...base, cantidad });
  }
  return out;
}

/** Campos CSV → columnas tabla depósito (documentación). */
export const MAPA_CSV_A_DEPOSITO: { csv: string; bd: string }[] = [
  { csv: "CODIGO ARTICULO", bd: "codigo_barras" },
  { csv: "COD.ART.PROVEEDOR", bd: "linea_codigo_proveedor + referencia_codigo_proveedor" },
  { csv: "COD.MATERIAL", bd: "excel_material_code → material_id" },
  { csv: "COD.COLOR", bd: "excel_color_code → color_id" },
  { csv: "DESCRIPCION GRADA", bd: "grada (talla abierta Bazzar)" },
  { csv: "LPN", bd: "precio_unitario (÷1000 si ≥1000)" },
  { csv: "COD.GRUPO", bd: "hint id_marca · ramo calzado/confección · matriz tienda" },
  { csv: "(derivado)", bd: "proveedor_id 654|638 · tipo_v2_id 1|2 · codigo bigint catálogo" },
  { csv: "S00_D1", bd: "cantidad · deposito_1_2100_tienda" },
  { csv: "S00_D2", bd: "cantidad · deposito_2_2100_guardado" },
  { csv: "S00_NINHOS", bd: "cantidad · deposito_1_2900_tienda" },
];
