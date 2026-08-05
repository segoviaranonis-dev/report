/**
 * PDF Stock PE · partición marca × caso × LP.
 * Layout 654: 2 columnas · material/color · grada|cantidad (dos contenedores) · Excel · OK.
 * Canon grada: `34(1 2 3 3 2 1)39` — ver CHUSAR 2.3.1.35.8
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { fetchPdfImage } from "@/lib/pdf/pdfImageUtils";
import {
  parseCasoLabelCompuesto,
  slugArchivoParticion,
  type CadenaPdf,
} from "./particion-etiqueta";

/** Una fila visual: fórmula grada (izq) + cantidad (der) — nunca concatenar. */
export type PeGradaLinea = {
  grada: string;
  cantidad: number;
};

export type PePdfRow = {
  linea: string;
  referencia: string;
  material: string;
  color: string;
  descpMaterial: string;
  descpColor: string;
  grada: string;
  gradesJson?: Record<string, number> | null;
  /** Desglose canónico por curva; si vacío se deriva de `grada` + `saldo`. */
  gradaLineas?: PeGradaLinea[];
  estilo: string;
  saldo: number;
  precio: number;
  imagen_url: string | null;
  imagenNombre: string;
  excelPadre: string;
  qtyExcel: number | null;
};

export type PePdfParticion = {
  marca: string;
  casoLabel: string;
  /** NORMAL | PROMO — va en el nombre del archivo junto a AB/CR */
  cadenaComercial?: CadenaPdf | null;
  particionId?: string;
  listaPrecio: "LPN" | "LPC03" | "LPC04";
  depositoLabel?: string;
  excelPadreLabel?: string;
  rows: PePdfRow[];
};

const INK = rgb(0.0, 0.169, 0.306);
const MUTED = rgb(0.4, 0.45, 0.5);
const RULE = rgb(0.85, 0.87, 0.9);
const OK_GREEN = rgb(0.06, 0.45, 0.22);
const BAD_RED = rgb(0.7, 0.12, 0.12);
const QTY_BG = rgb(0.94, 0.96, 0.98);
const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 32;
const MAX_GRADAS_VISIBLE = 8;

function sanitize(s: string) {
  return (s || "").replace(/[\u0000-\u001f]/g, " ").slice(0, 220);
}

function fmtInt(n: number) {
  return new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(n);
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat("es-PY", {
    style: "currency",
    currency: "PYG",
    maximumFractionDigits: 0,
  }).format(n);
}

function text(
  page: PDFPage,
  s: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color = INK,
) {
  page.drawText(sanitize(s), { x, y, size, font, color });
}

/**
 * Canon 654: `34(1 2 3 3 2 1)39` (espacios dentro del paréntesis).
 * Acepta guiones del fmt web y normaliza a espacios.
 */
export function normalizarGradaCanon(raw: string): string {
  const g = String(raw ?? "").trim();
  if (!g) return "";
  const m = g.match(/^(.+?)\(([^)]+)\)(.*)$/);
  if (!m) return g;
  const inner = m[2]!
    .trim()
    .split(/[\s\-]+/)
    .filter(Boolean)
    .join(" ");
  return `${m[1]!.trim()}(${inner})${(m[3] ?? "").trim()}`;
}

/** Extrae fórmulas sin juntarlas con `/` en una sola línea. */
export function extraerFormulasGrada(raw: string): string[] {
  const g = String(raw ?? "").trim();
  if (!g) return [];
  const matches = g.match(/\d+(?:\/\d+)*\s*\([^)]+\)\s*\d+(?:\/\d+)*/g);
  if (matches?.length) return matches.map(normalizarGradaCanon);
  return [normalizarGradaCanon(g)].filter(Boolean);
}

export function lineasDesdeRow(r: PePdfRow): PeGradaLinea[] {
  if (r.gradaLineas?.length) {
    return r.gradaLineas.map((l) => ({
      grada: normalizarGradaCanon(l.grada),
      cantidad: Math.round(l.cantidad) || 0,
    }));
  }
  const formulas = extraerFormulasGrada(r.grada);
  if (formulas.length === 1) {
    return [{ grada: formulas[0]!, cantidad: Math.round(r.saldo) || 0 }];
  }
  if (formulas.length > 1) {
    // Fila ya venía concatenada (anti-patrón legacy): no inventar split de qty
    return formulas.map((grada) => ({ grada, cantidad: 0 }));
  }
  return r.grada
    ? [{ grada: normalizarGradaCanon(r.grada), cantidad: Math.round(r.saldo) || 0 }]
    : [];
}

export function cantidadesIguales(saldo: number, qtyExcel: number | null): boolean {
  if (qtyExcel == null || !Number.isFinite(qtyExcel)) return false;
  return Math.round(saldo) === Math.round(qtyExcel);
}

export function basenameImagen(url: string | null | undefined, fallback = ""): string {
  if (!url) return fallback;
  try {
    const path = url.split("?")[0] ?? url;
    const name = path.split("/").pop() ?? "";
    return name.replace(/\.(jpe?g|png|webp)$/i, "") || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Agrupa L+R+M+C: una tarjeta.
 * Cada fórmula de grada conserva su cantidad — nunca `grada1/grada2` en un string.
 */
export function agruparPorMolecula(rows: PePdfRow[]): PePdfRow[] {
  const map = new Map<string, PePdfRow>();
  for (const r of rows) {
    const key = [r.linea, r.referencia, r.material, r.color].join("|");
    const prev = map.get(key);
    const aportes = lineasDesdeRow(r);

    if (!prev) {
      const gradaLineas = mergeGradaLineas([], aportes);
      map.set(key, {
        ...r,
        grada: gradaLineas[0]?.grada ?? r.grada,
        gradaLineas,
      });
      continue;
    }

    prev.saldo += r.saldo;
    if (r.qtyExcel != null) {
      prev.qtyExcel = (prev.qtyExcel ?? 0) + r.qtyExcel;
    }
    prev.gradaLineas = mergeGradaLineas(prev.gradaLineas ?? [], aportes);
    prev.grada = prev.gradaLineas[0]?.grada ?? prev.grada;
    if (!prev.imagen_url && r.imagen_url) prev.imagen_url = r.imagen_url;
    if (!prev.imagenNombre && r.imagenNombre) prev.imagenNombre = r.imagenNombre;
    if (!prev.excelPadre && r.excelPadre) prev.excelPadre = r.excelPadre;
    if (!prev.descpMaterial && r.descpMaterial) prev.descpMaterial = r.descpMaterial;
    if (!prev.descpColor && r.descpColor) prev.descpColor = r.descpColor;
    if (r.precio > 0 && (prev.precio <= 0 || r.precio < prev.precio)) prev.precio = r.precio;
  }
  // Orden canónico L+R+M+C · menor → mayor
  return [...map.values()].sort(cmpMoleculaAsc);
}

/** Compara códigos L / R / M / C como número si aplica, si no texto. */
function cmpCodigoAsc(a: string, b: string): number {
  const na = Number(String(a).trim());
  const nb = Number(String(b).trim());
  const aNum = Number.isFinite(na) && String(a).trim() !== "";
  const bNum = Number.isFinite(nb) && String(b).trim() !== "";
  if (aNum && bNum && na !== nb) return na - nb;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export function cmpMoleculaAsc(a: PePdfRow, b: PePdfRow): number {
  return (
    cmpCodigoAsc(a.linea, b.linea) ||
    cmpCodigoAsc(a.referencia, b.referencia) ||
    cmpCodigoAsc(a.material, b.material) ||
    cmpCodigoAsc(a.color, b.color)
  );
}

function mergeGradaLineas(base: PeGradaLinea[], add: PeGradaLinea[]): PeGradaLinea[] {
  const m = new Map<string, number>();
  for (const l of [...base, ...add]) {
    const g = normalizarGradaCanon(l.grada) || "—";
    m.set(g, (m.get(g) ?? 0) + (Math.round(l.cantidad) || 0));
  }
  return [...m.entries()]
    .map(([grada, cantidad]) => ({ grada, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);
}

function desgloseEstilos(rows: PePdfRow[]): { estilo: string; pares: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const e = (r.estilo || "SIN ESTILO").trim().toUpperCase() || "SIN ESTILO";
    m.set(e, (m.get(e) ?? 0) + r.saldo);
  }
  return [...m.entries()]
    .map(([estilo, pares]) => ({ estilo, pares }))
    .sort((a, b) => b.pares - a.pares);
}

export function nombreArchivoParticion(p: PePdfParticion): string {
  const parsed = parseCasoLabelCompuesto(p.casoLabel);
  const particionId =
    p.particionId ||
    (parsed.tipo.tag === "CR"
      ? "CERRADO"
      : parsed.tipo.tag === "AB"
        ? "ABIERTO"
        : parsed.tipo.tag === "ANT"
          ? "ANTEOJOS"
          : parsed.tipo.tag === "CAR"
            ? "CARTERAS"
            : parsed.tipo.tag === "PROMO"
              ? "PROMOCIONAL"
              : "NORMAL");
  return slugArchivoParticion({
    marca: p.marca,
    particionId,
    cadena: p.cadenaComercial ?? parsed.cadena,
    listaPrecio: p.listaPrecio,
  });
}

/** Dibuja fila: [fórmula grada] …… [cantidad] — dos contenedores. */
function drawGradaCantidadRow(
  page: PDFPage,
  x: number,
  cellW: number,
  y: number,
  grada: string,
  cantidad: number,
  font: PDFFont,
  fontBold: PDFFont,
) {
  const pad = 5;
  const qtyBoxW = 36;
  const gap = 14; // espacio considerable entre contenedores
  const leftW = cellW - pad * 2 - gap - qtyBoxW;
  const rowH = 12;

  // Contenedor izquierda — fórmula
  page.drawRectangle({
    x: x + pad,
    y: y - 2,
    width: leftW,
    height: rowH,
    borderColor: RULE,
    borderWidth: 0.4,
    color: rgb(1, 1, 1),
  });
  const gTxt = sanitize(grada).slice(0, 28);
  text(page, gTxt, x + pad + 3, y + 1, 6.5, font, INK);

  // Contenedor derecha — cantidad
  const qx = x + pad + leftW + gap;
  page.drawRectangle({
    x: qx,
    y: y - 2,
    width: qtyBoxW,
    height: rowH,
    borderColor: RULE,
    borderWidth: 0.4,
    color: QTY_BG,
  });
  const qTxt = cantidad > 0 ? fmtInt(cantidad) : "—";
  const qSize = 7;
  const qW = fontBold.widthOfTextAtSize(qTxt, qSize);
  text(page, qTxt, qx + (qtyBoxW - qW) / 2, y + 1, qSize, fontBold, INK);
}

export async function generarPdfStockPeParticion(
  particion: PePdfParticion,
): Promise<{ buffer: Buffer; filename: string; totalPares: number; estilos: number }> {
  const agrupados = agruparPorMolecula(particion.rows.filter((r) => r.saldo > 0));
  const totalPares = agrupados.reduce((s, r) => s + r.saldo, 0);
  if (totalPares <= 0) {
    throw new Error("Partición sin stock — no generar PDF");
  }
  const estilos = desgloseEstilos(agrupados);
  const okCount = agrupados.filter((r) => cantidadesIguales(r.saldo, r.qtyExcel)).length;
  const excelPadre =
    particion.excelPadreLabel ||
    [...new Set(agrupados.map((r) => r.excelPadre).filter(Boolean))].join(" · ") ||
    "—";

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const images = new Map<string, PDFImage>();
  const urls = [...new Set(agrupados.map((r) => r.imagen_url).filter(Boolean))] as string[];
  const concurrency = 6;
  for (let i = 0; i < urls.length; i += concurrency) {
    const chunk = urls.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (url) => {
        try {
          const bytes = await fetchPdfImage(url, { timeout: 12000, retries: 2, useThumbnail: true });
          if (!bytes) return;
          const img = url.toLowerCase().includes(".png")
            ? await pdf.embedPng(bytes)
            : await pdf.embedJpg(bytes);
          images.set(url, img);
        } catch {
          /* placeholder */
        }
      }),
    );
  }

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const filename = nombreArchivoParticion(particion);
  const parsed = parseCasoLabelCompuesto(particion.casoLabel);
  const cadena = particion.cadenaComercial ?? parsed.cadena;
  const cadenaTxt =
    cadena === "PROMO"
      ? "PROMO"
      : cadena === "LIQUIDACION"
        ? "LIQUIDACION"
        : cadena === "COMUN"
          ? "COMUN"
          : cadena === "NORMAL"
            ? "NORMAL"
            : null;
  // Marca sola arriba · LP solo en el banner (no duplicar LPN)
  const titulo = particion.marca.toUpperCase();

  text(page, "STOCK PRONTA ENTREGA · PROVEEDOR 654", MARGIN, y, 9, fontBold, MUTED);
  y -= 18;
  text(page, titulo, MARGIN, y, 16, fontBold);
  // Espacio bajo el título (baseline) antes del banner — evita pisar
  y -= 22;

  // Banner: Cerrado (CR) · Normal · LPN — una sola franja, sin solapar título
  const tipoLine = [
    parsed.tipo.tag
      ? `${parsed.tipo.label.toUpperCase()} [${parsed.tipo.tag}]`
      : particion.casoLabel.toUpperCase(),
    cadenaTxt,
    particion.listaPrecio,
  ]
    .filter(Boolean)
    .join("  ·  ");
  const tipoBoxH = 24;
  const tipoBoxBottom = y - tipoBoxH;
  page.drawRectangle({
    x: MARGIN,
    y: tipoBoxBottom,
    width: PAGE_W - MARGIN * 2,
    height: tipoBoxH,
    color: rgb(0.0, 0.169, 0.306),
  });
  // Texto centrado verticalmente en la caja
  text(page, tipoLine, MARGIN + 10, tipoBoxBottom + 7, 11, fontBold, rgb(1, 1, 1));
  y = tipoBoxBottom - 12;

  text(page, `Excel padre: ${excelPadre}`, MARGIN, y, 9, font, MUTED);
  y -= 11;
  if (particion.depositoLabel) {
    text(page, `Depósito: ${particion.depositoLabel}`, MARGIN, y, 8, font, MUTED);
    y -= 10;
  }
  text(
    page,
    `Generado: ${new Date().toLocaleString("es-PY")} · OK ${okCount}/${agrupados.length} (saldo = Excel)`,
    MARGIN,
    y,
    8,
    font,
    MUTED,
  );
  y -= 16;

  const estH = Math.min(estilos.length, 8) * 11 + 28;
  page.drawRectangle({
    x: MARGIN,
    y: y - estH + 10,
    width: PAGE_W - MARGIN * 2,
    height: estH,
    borderColor: RULE,
    borderWidth: 0.8,
    color: rgb(0.97, 0.98, 0.99),
  });
  text(page, `TOTAL  ${fmtInt(totalPares)} pares`, MARGIN + 8, y - 2, 12, fontBold);
  y -= 18;
  const maxEst = Math.min(estilos.length, 8);
  for (let i = 0; i < maxEst; i++) {
    const e = estilos[i]!;
    text(page, e.estilo, MARGIN + 8, y, 8, font);
    text(page, fmtInt(e.pares), PAGE_W - MARGIN - 48, y, 8, fontBold, MUTED);
    y -= 11;
  }
  if (estilos.length > 8) {
    text(page, `+${estilos.length - 8} estilos…`, MARGIN + 8, y, 7, font, MUTED);
    y -= 11;
  }
  y -= 14;

  const COLS = 2;
  const gap = 12;
  const cellW = (PAGE_W - MARGIN * 2 - gap) / COLS;
  const imgH = 88;
  const metaH = 44; // código + img + material
  const footerH = 22; // total u + excel
  const gradaRowH = 14;
  let col = 0;
  let rowMaxH = 0;

  const ensureSpace = (need: number) => {
    if (y - need < MARGIN) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
      col = 0;
      rowMaxH = 0;
    }
  };

  for (const r of agrupados) {
    const lineas = lineasDesdeRow(r);
    const nGradas = Math.min(Math.max(lineas.length, 1), MAX_GRADAS_VISIBLE);
    const extra = lineas.length > MAX_GRADAS_VISIBLE ? 10 : 0;
    const cellH = imgH + metaH + nGradas * gradaRowH + footerH + extra + 8;
    ensureSpace(cellH + 4);

    if (col === 0) rowMaxH = cellH;
    else rowMaxH = Math.max(rowMaxH, cellH);

    const x = MARGIN + col * (cellW + gap);
    const top = y;
    const ok = cantidadesIguales(r.saldo, r.qtyExcel);

    page.drawRectangle({
      x,
      y: top - cellH,
      width: cellW,
      height: cellH,
      borderColor: RULE,
      borderWidth: 0.6,
    });

    const img = r.imagen_url ? images.get(r.imagen_url) : undefined;
    if (img) {
      const scale = Math.min((cellW - 10) / img.width, imgH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      page.drawImage(img, {
        x: x + (cellW - w) / 2,
        y: top - 6 - h,
        width: w,
        height: h,
      });
    } else {
      text(page, "S/IMG", x + 8, top - 48, 9, font, MUTED);
    }

    let ly = top - imgH - 12;
    text(page, `${r.linea}-${r.referencia}`, x + 5, ly, 9, fontBold);
    const badge = ok ? "OK" : "NO";
    text(page, badge, x + cellW - (ok ? 22 : 24), ly, 8, fontBold, ok ? OK_GREEN : BAD_RED);
    ly -= 11;

    const imgName = r.imagenNombre || basenameImagen(r.imagen_url, r.color);
    text(page, `img: ${imgName}`.slice(0, 42), x + 5, ly, 6.5, font, MUTED);
    ly -= 10;

    const matCol = `${r.descpMaterial || r.material} · ${r.descpColor || r.color}`;
    text(page, matCol.slice(0, 46), x + 5, ly, 7, font);
    ly -= 12;

    // Filas: {grada}     {cantidad} — dos contenedores
    const visible = lineas.slice(0, MAX_GRADAS_VISIBLE);
    if (!visible.length) {
      drawGradaCantidadRow(page, x, cellW, ly, "—", Math.round(r.saldo), font, fontBold);
      ly -= gradaRowH;
    } else {
      for (const gl of visible) {
        drawGradaCantidadRow(page, x, cellW, ly, gl.grada, gl.cantidad, font, fontBold);
        ly -= gradaRowH;
      }
      if (lineas.length > MAX_GRADAS_VISIBLE) {
        text(page, `+${lineas.length - MAX_GRADAS_VISIBLE} gradas…`, x + 5, ly, 6, font, MUTED);
        ly -= 10;
      }
    }

    ly -= 2;
    text(page, `${fmtInt(r.saldo)} u · ${fmtMoney(r.precio)}`, x + 5, ly, 8, fontBold);
    ly -= 10;
    text(page, `Excel: ${r.excelPadre || "—"}`, x + 5, ly, 6, font, MUTED);

    col += 1;
    if (col >= COLS) {
      col = 0;
      y -= rowMaxH + 8;
      rowMaxH = 0;
    }
  }

  const bytes = await pdf.save();
  return {
    buffer: Buffer.from(bytes),
    filename,
    totalPares,
    estilos: estilos.length,
  };
}
