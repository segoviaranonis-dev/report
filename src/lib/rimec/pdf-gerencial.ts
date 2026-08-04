/**
 * Motor PDF gerencial Sales Report — paridad Streamlit `ReportEngine.generate_pdf`.
 * ReportLab → pdf-lib. Datos: `registro_ventas_general_v2` / pivot (módulo blindado).
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  ALIAS_CURRENT_VALUE,
  ALIAS_TARGET_VALUE,
  ALIAS_VARIATION,
} from "@/modules/sales-report/constants";

export type RimecPdfMeta = {
  porcentaje?: string;
  depto?: string;
  cat?: string;
  periodo?: string;
  objetivo_puro?: number;
};

export type RimecPdfMode = "gerencial" | "listado";

export type RimecPdfOptions = {
  title: string;
  rows: Record<string, unknown>[];
  groupCols?: string[];
  columns?: string[];
  meta?: RimecPdfMeta;
  showTotal?: boolean;
  mode?: RimecPdfMode;
  /** Tope de filas hoja (protección memoria local). */
  maxLeafRows?: number;
};

const P = {
  NAVY: rgb(0x1b / 255, 0x3a / 255, 0x6b / 255),
  NAVY_MID: rgb(0x2d / 255, 0x50 / 255, 0x80 / 255),
  SLATE: rgb(0x33 / 255, 0x41 / 255, 0x55 / 255),
  MUTED: rgb(0x64 / 255, 0x74 / 255, 0x8b / 255),
  BORDER_LT: rgb(0xe2 / 255, 0xe8 / 255, 0xf0 / 255),
  BORDER_SUB: rgb(0xa8 / 255, 0xc0 / 255, 0xd8 / 255),
  BG_ALT: rgb(0xfa / 255, 0xfb / 255, 0xfd / 255),
  WHITE: rgb(1, 1, 1),
  /**
   * Azul subtítulo / subtotal (Streamlit BG_L2) — una sola familia, más intenso en raíz.
   * Psicología: calma · continuidad · jerarquía por acento lateral, no por contraste brutal.
   */
  SUB: rgb(0xc5 / 255, 0xd9 / 255, 0xee / 255),
  SUB_DEEP: rgb(0xb0 / 255, 0xcb / 255, 0xe4 / 255),
  SUB_SOFT: rgb(0xd9 / 255, 0xe7 / 255, 0xf4 / 255),
  ACCENT: rgb(0x1b / 255, 0x3a / 255, 0x6b / 255),
  GOLD: rgb(0xd4 / 255, 0xaf / 255, 0x37 / 255),
  SUCCESS: rgb(0x05 / 255, 0x96 / 255, 0x69 / 255),
  CRITICAL: rgb(0xdc / 255, 0x26 / 255, 0x26 / 255),
};

const PAGE_W = 841.89; // A4 landscape
const PAGE_H = 595.28;
const MARGIN = 28;
const ROW_H = 11;
const ROW_H_SUB = 12.5;
const FONT_SIZE = 6.2;
const FONT_SIZE_SUB = 6.5;
const HEADER_H = 52;

function num(v: unknown): number {
  if (v == null || v === "") return NaN;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function isPctCol(col: string): boolean {
  const u = col.toUpperCase();
  return u.includes("%") || u.includes("VAR") || u.includes("VARIACION") || u.includes("VARIACIÓN");
}

/** Helvetica WinAnsi — sin unicode raro. */
function asciiSafe(s: string): string {
  return s.replace(/[^\x20-\x7E]/g, (ch) => {
    if (ch === "∞") return "INF";
    if (ch === "·" || ch === "•") return "-";
    if (ch === "Σ") return "SUB";
    if (ch === "Á" || ch === "À") return "A";
    if (ch === "É") return "E";
    if (ch === "Í") return "I";
    if (ch === "Ó") return "O";
    if (ch === "Ú" || ch === "Ü") return "U";
    if (ch === "Ñ") return "N";
    if (ch === "á" || ch === "à") return "a";
    if (ch === "é") return "e";
    if (ch === "í") return "i";
    if (ch === "ó") return "o";
    if (ch === "ú" || ch === "ü") return "u";
    if (ch === "ñ") return "n";
    return "?";
  });
}

function isNumCol(col: string, sample: unknown): boolean {
  if (isPctCol(col)) return true;
  if (typeof sample === "number") return true;
  const n = num(sample);
  return Number.isFinite(n) && String(sample).trim() !== "";
}

function fmtValue(val: unknown, col: string): string {
  if (val == null || val === "") return "";
  if (isPctCol(col)) {
    const n = num(val);
    if (!Number.isFinite(n)) return "INF";
    const show = Math.abs(n) <= 2.1 ? n * 100 : n;
    return `${show.toLocaleString("es-PY", { maximumFractionDigits: 2 })}%`;
  }
  const n = num(val);
  if (Number.isFinite(n) && typeof val !== "string") {
    return Math.round(n).toLocaleString("es-PY", { maximumFractionDigits: 0 });
  }
  if (Number.isFinite(n) && /monto|obj|cant/i.test(col)) {
    return Math.round(n).toLocaleString("es-PY", { maximumFractionDigits: 0 });
  }
  return asciiSafe(String(val));
}

function pickColumns(rows: Record<string, unknown>[], explicit?: string[]): string[] {
  if (explicit?.length) return explicit.filter((c) => rows.some((r) => c in r));
  if (!rows.length) return [];
  const skip = new Set(["_path", "LEVEL", "IS_SUBTOTAL", "mes_idx", "Auto Unique ID"]);
  // Orden = inserción de la 1ª fila (rows* canónicos Streamlit). No reordenar.
  return Object.keys(rows[0])
    .filter((k) => !k.startsWith("_") && !k.startsWith(":") && !skip.has(k) && !/AUTO_UNIQUE/i.test(k))
    .slice(0, 10);
}

function sumCol(rows: Record<string, unknown>[], col: string): number {
  let s = 0;
  for (const r of rows) {
    const n = num(r[col]);
    if (Number.isFinite(n)) s += n;
  }
  return s;
}

function subVar(rows: Record<string, unknown>[], cols: string[]): number | null {
  const cR =
    cols.find((c) => /26/i.test(c) && !/cant/i.test(c)) ??
    cols.find((c) => c === ALIAS_CURRENT_VALUE || /real.?2026|monto.?26/i.test(c));
  const cO =
    cols.find((c) => /obj/i.test(c) && !/cant/i.test(c)) ??
    cols.find((c) => c === ALIAS_TARGET_VALUE);
  if (!cR || !cO) return null;
  const obj = sumCol(rows, cO);
  const real = sumCol(rows, cR);
  if (obj > 0) return ((real - obj) / obj) * 100;
  if (real > 0) return null;
  return 0;
}

type BuiltRow = {
  cells: string[];
  kind: "header" | "data" | "sub" | "total";
  level?: number;
  /** true = celda vacía por jerarquía → fondo blanco (solo filas data) */
  blankCells?: boolean[];
  /** Índice de columna donde inicia el subtotal (azul solo desde aquí → derecha) */
  startCol?: number;
};

function buildRows(
  data: Record<string, unknown>[],
  cols: string[],
  groupCols: string[],
  mode: RimecPdfMode,
  showTotal: boolean,
  maxLeaf: number,
): BuiltRow[] {
  const out: BuiltRow[] = [{ cells: cols.map((c) => c.toUpperCase()), kind: "header" }];
  let leafCount = 0;
  const hv: Record<string, unknown> = {};

  const pushData = (row: Record<string, unknown>, level: number) => {
    if (leafCount >= maxLeaf) return;
    leafCount++;
    const blankCells = cols.map(() => false);
    const cells = cols.map((c, i) => {
      if (mode === "gerencial" && groupCols.includes(c)) {
        const gi = groupCols.indexOf(c);
        let ancestorsSame = true;
        for (let a = 0; a < gi; a++) {
          const ac = groupCols[a];
          if (String(row[ac] ?? "") !== String(hv[ac] ?? "\0")) {
            ancestorsSame = false;
            break;
          }
        }
        if (ancestorsSame && hv[c] !== undefined && row[c] === hv[c]) {
          blankCells[i] = true;
          return "";
        }
        hv[c] = row[c];
        for (let d = gi + 1; d < groupCols.length; d++) {
          delete hv[groupCols[d]];
        }
        return fmtValue(row[c], c);
      }
      return fmtValue(row[c], c);
    });
    out.push({ cells, kind: "data", level, blankCells });
  };

  const pushSub = (name: unknown, level: number, grp: Record<string, unknown>[], gCol: string) => {
    const sc = cols.indexOf(gCol);
    const label = `${"  ".repeat(level)}+  ${String(name)}`;
    const blankCells = cols.map(() => false);
    const cells = cols.map((c, i) => {
      if (i < sc) {
        blankCells[i] = true;
        return "";
      }
      if (c === gCol) return label;
      if (isPctCol(c)) {
        const v = subVar(grp, cols);
        return v === null ? "INF" : fmtValue(v, c);
      }
      if (grp.some((r) => isNumCol(c, r[c]))) return fmtValue(sumCol(grp, c), c);
      blankCells[i] = true;
      return "";
    });
    out.push({ cells, kind: "sub", level, blankCells, startCol: Math.max(0, sc) });
  };

  function process(cDf: Record<string, unknown>[], groups: string[], level: number) {
    if (leafCount >= maxLeaf) return;
    if (level >= groups.length) {
      for (const row of cDf) pushData(row, level);
      return;
    }
    const gCol = groups[level];
    const isLast = level === groups.length - 1;
    const names = [...new Set(cDf.map((r) => String(r[gCol] ?? "")))];
    for (const name of names) {
      const grp = cDf.filter((r) => String(r[gCol] ?? "") === name);
      process(grp, groups, level + 1);
      // Sin subtotal en último nivel; sin eco si el grupo es una sola hoja
      if (!isLast && mode === "gerencial" && grp.length > 1) {
        pushSub(name, level, grp, gCol);
      }
    }
  }

  if (mode === "listado" || !groupCols.length) {
    for (const row of data) pushData(row, 0);
  } else {
    process(data, groupCols, 0);
  }

  if (showTotal && mode === "gerencial" && data.length) {
    let firstText = false;
    const cells = cols.map((c) => {
      if (isPctCol(c)) {
        const v = subVar(data, cols);
        return v === null ? "INF" : fmtValue(v, c);
      }
      if (data.some((r) => isNumCol(c, r[c]))) return fmtValue(sumCol(data, c), c);
      if (!firstText) {
        firstText = true;
        return "TOTAL GENERAL";
      }
      return "";
    });
    out.push({ cells, kind: "total" });
  }

  return out;
}

function colWidths(cols: string[], usable: number): number[] {
  const weights = cols.map((c) => {
    const u = c.toUpperCase();
    if (/CLIENTE/.test(u)) return 3.2;
    if (/CADENA|VENDEDOR/.test(u)) return 2.5;
    if (/MARCA/.test(u)) return 1.8;
    if (/MES|SEMESTRE/.test(u)) return 1.1;
    if (/ESTADO/.test(u)) return 1.6;
    return 1.0;
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => (w / sum) * usable);
}

function drawHeader(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  title: string,
  meta: RimecPdfMeta,
) {
  const now = new Date();
  const stamp = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}  ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  page.drawText(asciiSafe("RIMEC - NEXUS REPORT"), {
    x: MARGIN,
    y: PAGE_H - 18,
    size: 7,
    font,
    color: P.MUTED,
  });
  const titleSafe = asciiSafe(title.toUpperCase());
  const titleW = fontBold.widthOfTextAtSize(titleSafe, 11);
  page.drawText(titleSafe, {
    x: (PAGE_W - titleW) / 2,
    y: PAGE_H - 22,
    size: 11,
    font: fontBold,
    color: P.NAVY,
  });
  page.drawText(stamp, {
    x: PAGE_W - MARGIN - font.widthOfTextAtSize(stamp, 6),
    y: PAGE_H - 18,
    size: 6,
    font,
    color: P.MUTED,
  });
  const metaLine = asciiSafe(
    `Objetivo: ${meta.porcentaje ?? "N/A"}  -  Depto: ${meta.depto ?? "TODOS"}  -  Cat: ${meta.cat ?? "TODAS"}  -  Periodo: ${meta.periodo ?? "N/A"}`,
  );
  const metaW = font.widthOfTextAtSize(metaLine, 6);
  page.drawText(metaLine, {
    x: (PAGE_W - metaW) / 2,
    y: PAGE_H - 36,
    size: 6,
    font,
    color: P.MUTED,
  });
  page.drawRectangle({
    x: MARGIN,
    y: PAGE_H - HEADER_H + 4,
    width: PAGE_W - 2 * MARGIN,
    height: 1.5,
    color: P.NAVY,
  });
  page.drawRectangle({
    x: MARGIN,
    y: PAGE_H - HEADER_H + 1,
    width: PAGE_W - 2 * MARGIN,
    height: 0.8,
    color: P.GOLD,
  });
}

/**
 * Genera PDF gerencial (landscape) con jerarquía / subtotales / total.
 */
export async function generateRimecGerencialPdf(opts: RimecPdfOptions): Promise<Uint8Array> {
  const rows = opts.rows ?? [];
  if (!rows.length) throw new Error("Sin filas para PDF");
  const cols = pickColumns(rows, opts.columns);
  if (!cols.length) throw new Error("Sin columnas para PDF");
  const groupCols = (opts.groupCols ?? []).filter((g) => cols.includes(g));
  const mode = opts.mode ?? "gerencial";
  const showTotal = opts.showTotal !== false;
  const maxLeaf = opts.maxLeafRows ?? 2500;
  const built = buildRows(rows, cols, groupCols, mode, showTotal, maxLeaf);

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const usable = PAGE_W - 2 * MARGIN;
  const widths = colWidths(cols, usable);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  drawHeader(page, font, fontBold, opts.title, opts.meta ?? {});
  let y = PAGE_H - HEADER_H - 4;

  const ensureSpace = (need = ROW_H) => {
    if (y < MARGIN + need) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      drawHeader(page, font, fontBold, opts.title, opts.meta ?? {});
      y = PAGE_H - HEADER_H - 4;
    }
  };

  for (let ri = 0; ri < built.length; ri++) {
    const row = built[ri];
    const isSub = row.kind === "sub";
    const rowH = isSub ? ROW_H_SUB : ROW_H;
    const fontSz = isSub ? FONT_SIZE_SUB : FONT_SIZE;
    ensureSpace(rowH);

    let x = MARGIN;
    let bg = P.WHITE;
    let fg = P.SLATE;
    let useBold = false;
    let accentW = 0;
    const startCol = row.startCol ?? 0;

    if (row.kind === "header") {
      bg = P.NAVY;
      fg = P.WHITE;
      useBold = true;
    } else if (row.kind === "total") {
      bg = P.NAVY;
      fg = P.WHITE;
      useBold = true;
    } else if (isSub) {
      const lvl = row.level ?? 0;
      bg = lvl === 0 ? P.SUB_DEEP : lvl === 1 ? P.SUB : P.SUB_SOFT;
      fg = P.NAVY;
      useBold = true;
      accentW = lvl === 0 ? 3 : lvl === 1 ? 2 : 1.5;
    } else if (ri % 2 === 0) {
      bg = P.BG_ALT;
    }

    // Base blanca en toda la fila
    page.drawRectangle({
      x: MARGIN,
      y: y - rowH + 2,
      width: usable,
      height: rowH,
      color: row.kind === "data" && ri % 2 !== 0 ? P.WHITE : row.kind === "data" ? P.BG_ALT : P.WHITE,
    });

    if (row.kind === "header" || row.kind === "total") {
      page.drawRectangle({
        x: MARGIN,
        y: y - rowH + 2,
        width: usable,
        height: rowH,
        color: bg,
      });
    } else if (isSub) {
      // Azul solo desde la columna del subtotal → derecha (nunca a la izquierda)
      let subX = MARGIN;
      for (let i = 0; i < startCol; i++) subX += widths[i];
      const subW = usable - (subX - MARGIN);
      page.drawRectangle({
        x: subX,
        y: y - rowH + 2,
        width: Math.max(0, subW),
        height: rowH,
        color: bg,
      });
      if (accentW > 0 && subW > 0) {
        page.drawRectangle({
          x: subX,
          y: y - rowH + 2,
          width: accentW,
          height: rowH,
          color: lvlAccent(row.level ?? 0),
        });
      }
    } else if (row.kind === "data") {
      // zebra ya aplicado arriba; pintar blancos en celdas vacías de jerarquía
      x = MARGIN;
      for (let ci = 0; ci < cols.length; ci++) {
        const w = widths[ci];
        if (row.blankCells?.[ci]) {
          page.drawRectangle({
            x,
            y: y - rowH + 2,
            width: w,
            height: rowH,
            color: P.WHITE,
          });
        }
        x += w;
      }
    }

    x = MARGIN;
    for (let ci = 0; ci < cols.length; ci++) {
      const w = widths[ci];
      const text = row.cells[ci] ?? "";
      const sample = rows[0]?.[cols[ci]];
      const right = isNumCol(cols[ci], sample) || isPctCol(cols[ci]);
      const f = useBold ? fontBold : font;
      const onSubBand = isSub && ci >= startCol;
      const padL = onSubBand && ci === startCol ? accentW + 2 : 2;
      const maxW = w - padL - 2;
      let draw = asciiSafe(text);
      while (draw.length > 1 && f.widthOfTextAtSize(draw, fontSz) > maxW) {
        draw = draw.slice(0, -1);
      }
      const tw = f.widthOfTextAtSize(draw, fontSz);
      const tx = right ? x + w - 2 - tw : x + padL;
      let color = fg;
      if (row.kind === "data" && isPctCol(cols[ci]) && text) {
        const parsed = Number(String(text).replace("%", "").replace(/\./g, "").replace(",", "."));
        if (Number.isFinite(parsed) && parsed < 0) color = P.CRITICAL;
        else if (Number.isFinite(parsed) && parsed > 0) color = P.SUCCESS;
      }
      if (draw) {
        page.drawText(draw, {
          x: tx,
          y: y - rowH + (isSub ? 5.5 : 5),
          size: fontSz,
          font: f,
          color,
        });
      }
      x += w;
    }

    if (isSub) {
      let subX = MARGIN;
      for (let i = 0; i < startCol; i++) subX += widths[i];
      const subW = usable - (subX - MARGIN);
      page.drawRectangle({
        x: subX,
        y: y - rowH + 2,
        width: Math.max(0, subW),
        height: 0.55,
        color: P.BORDER_SUB,
      });
    } else {
      page.drawRectangle({
        x: MARGIN,
        y: y - rowH + 2,
        width: usable,
        height: 0.3,
        color: P.BORDER_LT,
      });
    }
    y -= rowH;
  }

  return doc.save();
}

function lvlAccent(level: number) {
  if (level === 0) return P.NAVY;
  if (level === 1) return P.NAVY_MID;
  return P.GOLD;
}

export function metaFromSnapshot(meta: {
  periodo?: string;
  objetivo_pct?: number;
  departamento?: string;
}): RimecPdfMeta {
  return {
    porcentaje: meta.objetivo_pct != null ? `${meta.objetivo_pct}%` : "N/A",
    depto: meta.departamento ?? "TODOS",
    cat: "TODAS",
    periodo: meta.periodo ?? "N/A",
    objetivo_puro: (meta.objetivo_pct ?? 20) / 100,
  };
}
