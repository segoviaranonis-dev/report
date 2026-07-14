/**
 * CSV stock pronta entrega RIMEC (sdrm####) → tabla unificada stock_pronta_entrega_rimec.
 * Depósito = columna deposito_codigo (D1 | DEP2 | D3), no tabla separada.
 * LPN = guaraníes enteros (sin ÷1000).
 */

export const PROVEEDOR_CALZADO = 654;
export const PROVEEDOR_CONFECCIONES = 638;

export type RimecDepositoCodigo = "D1" | "DEP2" | "D3";

export type RimecCsvDepositoColumn = "S00_D1" | "S00_DEP2" | "S00_D3";

export const RIMEC_SDRM_DEPOSIT_MAP: {
  csvColumn: RimecCsvDepositoColumn;
  deposito_codigo: RimecDepositoCodigo;
  label: string;
}[] = [
  { csvColumn: "S00_D1", deposito_codigo: "D1", label: "Depósito 1 · piso importadora" },
  { csvColumn: "S00_DEP2", deposito_codigo: "DEP2", label: "Depósito 2 · bodega" },
  { csvColumn: "S00_D3", deposito_codigo: "D3", label: "Depósito 3 · pronta entrega" },
];

export const SDRM_FILENAME_REGEX = /^sdrm(\d+)\.(csv|txt|xlsx)$/i;

export function batchLabelFromFilename(name: string): string {
  const m = name.match(SDRM_FILENAME_REGEX);
  return m ? `sdrm${m[1]}` : name.replace(/\.[^.]+$/, "").toLowerCase();
}

export type RimecCsvSdrmRow = {
  codigo_barras: string;
  cod_art_proveedor: string;
  cod_grupo: string;
  cod_material: string;
  cod_color: string;
  descripcion_grada: string;
  lpn: string;
  s00_d1: number;
  s00_dep2: number;
  s00_d3: number;
};

/** LPN legacy POS RIMEC → guaraníes (valor directo). */
export function parseLpnGuaranies(raw: string): number | null {
  const n = Number(String(raw ?? "").replace(/\D/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

function qty(raw: string | undefined): number {
  const n = Number(String(raw ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function normalizeSdrmCsvRecord(raw: Record<string, string>): RimecCsvSdrmRow {
  const g = (k: string) => (raw[k] ?? raw[k.trim()] ?? "").trim();
  return {
    codigo_barras: g("CODIGO ARTICULO"),
    cod_art_proveedor: g("COD.ART.PROVEEDOR"),
    cod_grupo: g("COD.GRUPO"),
    cod_material: g("COD.MATERIAL"),
    cod_color: g("COD.COLOR"),
    descripcion_grada: g("DESCRIPCION GRADA"),
    lpn: g("LPN"),
    s00_d1: qty(g("S00_D1")),
    s00_dep2: qty(g("S00_DEP2")),
    s00_d3: qty(g("S00_D3")),
  };
}

export function proveedorFromCodigoBarras(codigoBarras: string): 654 | 638 | null {
  const pref = codigoBarras.trim().split(".")[0];
  if (pref === "654") return PROVEEDOR_CALZADO;
  if (pref === "638") return PROVEEDOR_CONFECCIONES;
  return null;
}

export function resolveDepositoCodigo(input?: string | null): RimecDepositoCodigo | undefined {
  if (!input) return undefined;
  const found = RIMEC_SDRM_DEPOSIT_MAP.find((x) => x.csvColumn === input);
  if (found) return found.deposito_codigo;
  if (input === "D1" || input === "DEP2" || input === "D3") return input;
  return undefined;
}

export const MAPA_CSV_SDRM_A_STOCK: { csv: string; bd: string }[] = [
  { csv: "CODIGO ARTICULO", bd: "codigo_barras" },
  { csv: "COD.ART.PROVEEDOR", bd: "cod_art_proveedor" },
  { csv: "COD.GRUPO", bd: "cod_grupo" },
  { csv: "COD.MATERIAL", bd: "excel_material_code → material_id" },
  { csv: "COD.COLOR", bd: "excel_color_code → color_id" },
  { csv: "DESCRIPCION GRADA", bd: "grada (curva importadora o talla conf.)" },
  { csv: "LPN", bd: "precio_unitario_gs (guaraníes directo)" },
  { csv: "S00_D1", bd: "cantidad · deposito_codigo=D1 · columna_stock_legal" },
  { csv: "S00_DEP2", bd: "cantidad · deposito_codigo=DEP2 · columna_stock_legal" },
  { csv: "S00_D3", bd: "cantidad · deposito_codigo=D3 · columna_stock_legal" },
  { csv: "(derivado)", bd: "monto_gs = cantidad × precio_unitario_gs" },
];
