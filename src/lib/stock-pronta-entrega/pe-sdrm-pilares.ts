/**
 * Pilares PE sdrm — espejo exacto de control_central/core/pilares/codigos.py
 * + import_rimec_pronta_entrega_csv._resolve_row (barcode 654/638 · L-R con punto).
 */
import { createHash } from "crypto";
import {
  batchLabelFromFilename,
  parseLpnGuaranies,
  PROVEEDOR_CALZADO,
  PROVEEDOR_CONFECCIONES,
  RIMEC_SDRM_DEPOSIT_MAP,
} from "@/lib/deposito-rimec/rimec-csv-sdrm";

export const TIPO_V2_CALZADO = 1;
export const TIPO_V2_CONFECCIONES = 2;
const KYLY_REF = 11;
const KYLY_LINEA_ALPHA_BASE = 638_000_000_000;
const KYLY_COLOR_ALPHA_BASE = 638_001_000_000;

export type PeSdrmExpandedLine = {
  deposito_codigo: string;
  columna_stock_legal: string;
  codigo_barras: string;
  cod_art_proveedor: string;
  cod_grupo: string;
  proveedor_id: number;
  tipo_v2_id: number;
  linea_cod: string;
  ref_cod: string;
  mat_cod: string;
  col_cod: string;
  excel_mat: string;
  excel_col: string;
  grada: string;
  cantidad: number;
  precio_gs: number;
  batch_label: string;
  ramo: "calzado" | "confecciones";
};

function canon(s: string): string {
  const t = String(s ?? "").trim();
  if (t.endsWith(".0") && /^\d+\.0$/.test(t)) return t.slice(0, -2);
  return t;
}

function kylyAlnumToBigint(s: string, base: number): bigint | null {
  const t = canon(s);
  if (!t) return null;
  const m = t.match(/^[Kk]?0*(\d+)$/);
  if (m) return BigInt(m[1]);
  if (/^\d+$/.test(t)) return BigInt(t);
  const digest = createHash("sha256").update(t.toUpperCase(), "utf8").digest("hex");
  const h = 10_000_000 + Number(BigInt(`0x${digest.slice(0, 12)}`) % 90_000_000n);
  return BigInt(base + h);
}

function pilarToBigint(codigo: string, proveedorId: number): bigint | null {
  const s = canon(codigo);
  if (!s || s.toLowerCase() === "nan" || s.toLowerCase() === "none") return null;
  if (/^\d+$/.test(s)) return BigInt(s);
  if (proveedorId === PROVEEDOR_CONFECCIONES) return kylyAlnumToBigint(s, KYLY_LINEA_ALPHA_BASE);
  return null;
}

function colorToBigint(codigo: string, proveedorId: number): bigint | null {
  const s = canon(codigo);
  if (!s || s.toLowerCase() === "nan" || s.toLowerCase() === "none") return null;
  if (/^\d+$/.test(s)) return BigInt(s);
  if (proveedorId === PROVEEDOR_CONFECCIONES) return kylyAlnumToBigint(s, KYLY_COLOR_ALPHA_BASE);
  return null;
}

function parseCalzadoLr(codArt: string): { linea: bigint; ref: bigint } | null {
  const t = canon(codArt).replace(",", ".");
  if (!t) return null;
  if (t.includes(".")) {
    const [a, b] = t.split(".", 2);
    if (/^\d+$/.test(a) && /^\d+$/.test(b)) return { linea: BigInt(a), ref: BigInt(b) };
  }
  if (/^\d+$/.test(t)) return { linea: BigInt(t), ref: 0n };
  return null;
}

function normalizeKyly(codArt: string, material: string, color: string) {
  const t = canon(codArt);
  let mat = canon(material);
  let col = canon(color);
  let linea = t;
  let ref = "K";
  if (t.includes(".")) {
    const [a, b] = t.split(".", 2);
    if (a.toUpperCase() === "K" && /^\d+$/.test(b)) {
      linea = b;
      ref = "K";
    } else if (/^\d+$/.test(a)) {
      linea = a;
      ref = b || "K";
    }
  }
  if (!mat && linea) mat = `K${linea}`;
  if (!col || col === "0") col = "K0001";
  return { linea, ref, mat, col };
}

function resolveRow(row: Record<string, string>): Omit<
  PeSdrmExpandedLine,
  "deposito_codigo" | "columna_stock_legal" | "cantidad" | "batch_label"
> | null {
  const cb = canon(row["CODIGO ARTICULO"] ?? "");
  const pref = cb.split(".")[0];
  let proveedor_id: number;
  let tipo_v2_id: number;
  if (pref === "654") {
    proveedor_id = PROVEEDOR_CALZADO;
    tipo_v2_id = TIPO_V2_CALZADO;
  } else if (pref === "638") {
    proveedor_id = PROVEEDOR_CONFECCIONES;
    tipo_v2_id = TIPO_V2_CONFECCIONES;
  } else {
    return null;
  }

  const cod_art = canon(row["COD.ART.PROVEEDOR"] ?? "");
  const cod_grupo = canon(row["COD.GRUPO"] ?? "");
  const cod_mat = canon(row["COD.MATERIAL"] ?? "");
  const cod_col = canon(row["COD.COLOR"] ?? "");
  const grada = canon(row["DESCRIPCION GRADA"] ?? "");
  const lpn = parseLpnGuaranies(row["LPN"] ?? "");
  if (lpn == null) return null;

  if (proveedor_id === PROVEEDOR_CALZADO) {
    const lr = parseCalzadoLr(cod_art);
    if (!lr) return null;
    const mat = pilarToBigint(cod_mat || String(lr.linea), proveedor_id);
    const col = colorToBigint(cod_col, proveedor_id);
    if (mat == null || col == null) return null;
    return {
      codigo_barras: cb,
      cod_art_proveedor: cod_art,
      cod_grupo,
      proveedor_id,
      tipo_v2_id,
      linea_cod: String(lr.linea),
      ref_cod: String(lr.ref),
      mat_cod: String(mat),
      col_cod: String(col),
      excel_mat: cod_mat,
      excel_col: cod_col,
      grada,
      precio_gs: lpn,
      ramo: "calzado",
    };
  }

  const n = normalizeKyly(cod_art, cod_mat, cod_col);
  const linea = pilarToBigint(n.linea, proveedor_id);
  let ref: bigint | null;
  const refS = canon(n.ref);
  if (!refS || refS.toUpperCase() === "K") ref = BigInt(KYLY_REF);
  else if (/^\d+$/.test(refS)) ref = BigInt(refS);
  else ref = pilarToBigint(refS, 638);
  const mat = pilarToBigint(n.mat, 638) ?? pilarToBigint(n.linea, 638);
  const col = colorToBigint(n.col, proveedor_id);
  if (linea == null || ref == null || mat == null || col == null) return null;
  return {
    codigo_barras: cb,
    cod_art_proveedor: cod_art,
    cod_grupo,
    proveedor_id,
    tipo_v2_id,
    linea_cod: String(linea),
    ref_cod: String(ref),
    mat_cod: String(mat),
    col_cod: String(col),
    excel_mat: n.mat,
    excel_col: n.col,
    grada,
    precio_gs: lpn,
    ramo: "confecciones",
  };
}

function parseQty(raw: string): number | null {
  const t = canon(raw);
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function parsePipeCsvLatin1(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const headers = lines[0].split("|").map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split("|");
    const rec: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) rec[headers[j]] = (parts[j] ?? "").trim();
    rows.push(rec);
  }
  return rows;
}

export function expandPeSdrmCsv(text: string, filename: string): PeSdrmExpandedLine[] {
  const batch = batchLabelFromFilename(filename);
  const out: PeSdrmExpandedLine[] = [];
  for (const raw of parsePipeCsvLatin1(text)) {
    const base = resolveRow(raw);
    if (!base) continue;
    for (const dep of RIMEC_SDRM_DEPOSIT_MAP) {
      const qty = parseQty(raw[dep.csvColumn] ?? "");
      if (qty == null) continue;
      out.push({
        ...base,
        deposito_codigo: dep.deposito_codigo,
        columna_stock_legal: dep.csvColumn,
        cantidad: qty,
        batch_label: batch,
      });
    }
  }
  return out;
}

export { batchLabelFromFilename };
