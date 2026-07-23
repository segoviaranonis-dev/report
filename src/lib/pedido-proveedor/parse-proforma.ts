import * as XLSX from "xlsx";

export type ProformaRow = {
  item: string;
  ncm: string;
  style_code: string;
  linea_codigo_proveedor: string;
  referencia_codigo_proveedor: string;
  name: string;
  material_code: string;
  material: string;
  color_code: string;
  color: string;
  brand: string;
  shop: string;
  boxes: number;
  pairs: number;
  unit_fob: number;
  amount_fob: number;
  grade_range: string;
  grades_json: Record<string, number>;
  /** CP confecciones 638 — col J Descripción (BLUSA, CONJ FEM) para catálogo Web. */
  material_label?: string;
};

function parsearLineaReferencia(valor: unknown): { linea: number; referencia: number | null } | null {
  if (valor == null || valor === "") return null;
  let valorStr = String(valor).trim();
  if (valorStr.toLowerCase() === "nan" || valorStr.toLowerCase() === "none") return null;
  if (typeof valor === "number" && Number.isFinite(valor)) {
    valorStr = Number.isInteger(valor) ? String(valor) : String(valor).replace(/\.?0+$/, "");
  }
  if (valorStr.includes(".")) {
    const [a, b] = valorStr.split(".", 2);
    const linea = Number.parseInt(a, 10);
    if (!Number.isFinite(linea)) return null;
    const ref = b ? Number.parseInt(b, 10) : null;
    return { linea, referencia: ref != null && Number.isFinite(ref) ? ref : null };
  }
  const n = Number.parseFloat(valorStr);
  if (!Number.isFinite(n)) return null;
  return { linea: Math.trunc(n), referencia: null };
}

function gradeLabel(v: unknown): string | null {
  if (v == null || v === "") return null;
  let s = String(v).trim();
  if (s.endsWith(".0")) s = s.slice(0, -2);
  return s || null;
}

function safeInt(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function safeFloat(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isNullItem(v: unknown): boolean {
  if (v == null || v === "") return true;
  if (typeof v === "number" && Number.isNaN(v)) return true;
  return false;
}

export function parseProforma(buffer: Buffer): {
  rows: ProformaRow[];
  totalPares: number;
  error?: string;
} {
  let raw: unknown[][];
  try {
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: false, raw: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return { rows: [], totalPares: 0, error: "Hoja Excel vacía." };
    raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true }) as unknown[][];
  } catch (e) {
    return {
      rows: [],
      totalPares: 0,
      error: `No se pudo leer el archivo: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  if (!raw.length || (raw[0]?.length ?? 0) < 15) {
    return { rows: [], totalPares: 0, error: "El archivo no tiene el formato esperado de Fatura Proforma." };
  }

  let offset = 0;
  let gradeStart = 14;
  let headerRowIdx = 0;

  for (let i = 0; i < Math.min(50, raw.length); i++) {
    const rowStrs = (raw[i] ?? []).map((x) => String(x ?? "").trim().toUpperCase());
    if (rowStrs.includes("STYLE") && rowStrs.includes("ITEM")) {
      headerRowIdx = i;
      offset = rowStrs.indexOf("ITEM");
      const amountIdx = rowStrs.indexOf("AMOUNT");
      gradeStart = amountIdx >= 0 ? amountIdx + 1 : 14 + offset;
      break;
    }
  }

  let currentGrades: string[] = [];
  const headerRow = raw[headerRowIdx] ?? [];
  for (let colI = gradeStart; colI < headerRow.length; colI++) {
    const lbl = gradeLabel(headerRow[colI]);
    if (lbl) currentGrades.push(lbl);
  }

  const rows: ProformaRow[] = [];
  const colPairsIdx = 11 + offset;
  const colStyleIdx = 2 + offset;

  for (let rowI = headerRowIdx + 1; rowI < raw.length; rowI++) {
    const row = raw[rowI] ?? [];
    if (offset >= row.length) continue;

    const itemVal = row[offset];
    const pairsStr = row[colPairsIdx] != null ? String(row[colPairsIdx]).trim().toUpperCase() : "";
    const col2Str = row[colStyleIdx] != null ? String(row[colStyleIdx]).trim().toUpperCase() : "";
    if (pairsStr === "TOTAL" || col2Str === "TOTAL") break;

    if (isNullItem(itemVal)) {
      const newGrades: string[] = [];
      for (let colI = gradeStart; colI < row.length; colI++) {
        const lbl = gradeLabel(row[colI]);
        if (lbl) newGrades.push(lbl);
      }
      if (newGrades.length) currentGrades = newGrades;
      continue;
    }

    const styleRaw =
      row[colStyleIdx] != null && row[colStyleIdx] !== ""
        ? typeof row[colStyleIdx] === "number"
          ? String(row[colStyleIdx])
          : String(row[colStyleIdx]).trim()
        : "";
    if (!styleRaw || styleRaw.toLowerCase() === "nan" || styleRaw.toLowerCase() === "none") continue;

    const parsed = parsearLineaReferencia(styleRaw);
    if (!parsed || parsed.referencia == null) continue;

    const gradesJson: Record<string, number> = {};
    for (let gI = 0; gI < currentGrades.length; gI++) {
      const colI = gradeStart + gI;
      if (colI < row.length) {
        const qty = safeInt(row[colI]);
        if (qty > 0) gradesJson[currentGrades[gI]] = qty;
      }
    }

    const active = Object.keys(gradesJson).sort((a, b) => Number(a.split("/")[0]) - Number(b.split("/")[0]));
    const gradeRange = active.length ? `${active[0]}-${active[active.length - 1]}` : "";

    rows.push({
      item: String(safeInt(itemVal)),
      ncm: row[1 + offset] != null ? String(row[1 + offset]).trim() : "",
      style_code: styleRaw,
      linea_codigo_proveedor: String(parsed.linea),
      referencia_codigo_proveedor: String(parsed.referencia),
      name: row[3 + offset] != null ? String(row[3 + offset]).trim() : "",
      material_code: row.length > 4 + offset ? String(safeInt(row[4 + offset])) : "0",
      material: row[5 + offset] != null ? String(row[5 + offset]).trim() : "",
      color_code: row.length > 6 + offset ? String(safeInt(row[6 + offset])) : "0",
      color: row[7 + offset] != null ? String(row[7 + offset]).trim() : "",
      brand: row[8 + offset] != null ? String(row[8 + offset]).trim() : "",
      shop: row.length > 9 + offset ? String(safeInt(row[9 + offset])) : "",
      boxes: row.length > 10 + offset ? safeInt(row[10 + offset]) : 0,
      pairs: row.length > 11 + offset ? safeInt(row[11 + offset]) : 0,
      unit_fob: row.length > 12 + offset ? safeFloat(row[12 + offset]) : 0,
      amount_fob: row.length > 13 + offset ? safeFloat(row[13 + offset]) : 0,
      grade_range: gradeRange,
      grades_json: gradesJson,
    });
  }

  if (!rows.length) {
    return { rows: [], totalPares: 0, error: "No se encontraron artículos en la proforma." };
  }

  const totalPares = rows.reduce((s, r) => s + r.pairs, 0);
  return { rows, totalPares };
}
