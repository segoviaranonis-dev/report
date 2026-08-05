/**
 * PDF Stock PE · Confecciones 638 (≠ 654).
 * Pivot = precio (LPN/LPC) · debajo tallas con prendas.
 * Canon Web: agruparTallasPorPrecio · CHUSAR 2.2.1.0.11
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { fetchPdfImage } from "@/lib/pdf/pdfImageUtils";
import {
  basenameImagen,
  cmpMoleculaAsc,
  nombreArchivoParticion,
  type PePdfParticion,
  type PePdfRow,
} from "./generar-pdf-stock-pe";
import { parseCasoLabelCompuesto } from "./particion-etiqueta";

type TallaLine = { talle: string; prendas: number; grada: string };
type PrecioBucket = { precio: number; tallas: TallaLine[]; prendas: number };
type Card638 = {
  key: string;
  row: PePdfRow;
  precios: PrecioBucket[];
  prendas: number;
};

const INK = rgb(0.0, 0.169, 0.306);
const MUTED = rgb(0.4, 0.45, 0.5);
const RULE = rgb(0.85, 0.87, 0.9);
const PRICE_BG = rgb(0.93, 0.96, 0.99);
const QTY_BG = rgb(0.94, 0.96, 0.98);
const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 32;
const MAX_PRECIOS_VISIBLE = 6;
const MAX_TALLAS_POR_PRECIO = 8;

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

/** `4(1)4` → `4` · paridad Web etiquetaTalleDesdeGrada */
export function etiquetaTalle638(grada: string | null | undefined): string {
  const raw = String(grada ?? "").trim();
  if (!raw) return "—";
  const m = raw.match(/^(\d+)\s*\(/);
  if (m?.[1]) return m[1];
  const lead = raw.match(/^(\d+)/);
  return lead?.[1] ?? raw.slice(0, 10);
}

function sortTalleKey(talle: string): number {
  const n = parseInt(String(talle).replace(/\D/g, ""), 10);
  if (Number.isFinite(n) && n > 0) return n;
  return String(talle).charCodeAt(0) * 1000;
}

/**
 * Tarjeta L+R+M+C · buckets por precio · tallas debajo.
 * No fusiona precios distintos (bug cocina 654).
 */
export function agrupar638PorPrecio(rows: PePdfRow[]): Card638[] {
  const cards = new Map<string, { base: PePdfRow; byPrice: Map<number, TallaLine[]> }>();

  for (const r of rows) {
    if (!(r.saldo > 0)) continue;
    const precio = Math.round(Number(r.precio) || 0);
    if (precio <= 0) continue;
    const key = [r.linea, r.referencia, r.material, r.color].join("|");
    let card = cards.get(key);
    if (!card) {
      card = { base: { ...r }, byPrice: new Map() };
      cards.set(key, card);
    } else {
      card.base.saldo += r.saldo;
      if (!card.base.imagen_url && r.imagen_url) card.base.imagen_url = r.imagen_url;
      if (!card.base.imagenNombre && r.imagenNombre) card.base.imagenNombre = r.imagenNombre;
      if (!card.base.excelPadre && r.excelPadre) card.base.excelPadre = r.excelPadre;
    }

    const talle = etiquetaTalle638(r.grada);
    const list = card.byPrice.get(precio) ?? [];
    const prev = list.find((t) => t.talle === talle);
    if (prev) prev.prendas += Math.round(r.saldo) || 0;
    else
      list.push({
        talle,
        prendas: Math.round(r.saldo) || 0,
        grada: r.grada || talle,
      });
    card.byPrice.set(precio, list);
  }

  const out: Card638[] = [];
  for (const [key, card] of cards) {
    const precios: PrecioBucket[] = [...card.byPrice.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([precio, tallas]) => {
        const sorted = [...tallas].sort(
          (a, b) => sortTalleKey(a.talle) - sortTalleKey(b.talle),
        );
        const prendas = sorted.reduce((s, t) => s + t.prendas, 0);
        return { precio, tallas: sorted, prendas };
      });
    const prendas = precios.reduce((s, p) => s + p.prendas, 0);
    out.push({ key, row: card.base, precios, prendas });
  }

  return out.sort((a, b) => cmpMoleculaAsc(a.row, b.row));
}

export async function generarPdfStockPe638Particion(
  particion: PePdfParticion,
): Promise<{ buffer: Buffer; filename: string; totalPares: number; estilos: number }> {
  const cards = agrupar638PorPrecio(particion.rows);
  const totalPrendas = cards.reduce((s, c) => s + c.prendas, 0);
  if (totalPrendas <= 0) {
    throw new Error("Partición 638 sin prendas — no generar PDF");
  }

  const estiloMap = new Map<string, number>();
  for (const c of cards) {
    const e = (c.row.estilo || "SIN ESTILO").toUpperCase();
    estiloMap.set(e, (estiloMap.get(e) ?? 0) + c.prendas);
  }
  const estilos = [...estiloMap.entries()]
    .map(([estilo, pares]) => ({ estilo, pares }))
    .sort((a, b) => b.pares - a.pares);

  const excelPadre =
    particion.excelPadreLabel ||
    [...new Set(cards.map((c) => c.row.excelPadre).filter(Boolean))].join(" · ") ||
    "—";

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const images = new Map<string, PDFImage>();
  const urls = [...new Set(cards.map((c) => c.row.imagen_url).filter(Boolean))] as string[];
  for (let i = 0; i < urls.length; i += 6) {
    const chunk = urls.slice(i, i + 6);
    await Promise.all(
      chunk.map(async (url) => {
        try {
          const bytes = await fetchPdfImage(url, {
            timeout: 12000,
            retries: 2,
            useThumbnail: true,
          });
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

  text(page, "STOCK PRONTA ENTREGA · PROVEEDOR 638", MARGIN, y, 9, fontBold, MUTED);
  y -= 18;
  text(page, particion.marca.toUpperCase(), MARGIN, y, 16, fontBold);
  y -= 22;

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
  text(page, tipoLine, MARGIN + 10, tipoBoxBottom + 7, 11, fontBold, rgb(1, 1, 1));
  y = tipoBoxBottom - 12;

  text(page, `Excel padre: ${excelPadre}`, MARGIN, y, 9, font, MUTED);
  y -= 11;
  text(
    page,
    `Generado: ${new Date().toLocaleString("es-PY")} · pivot = precio · tallas debajo`,
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
  text(page, `TOTAL  ${fmtInt(totalPrendas)} prendas`, MARGIN + 8, y - 2, 12, fontBold);
  y -= 18;
  for (let i = 0; i < Math.min(estilos.length, 8); i++) {
    const e = estilos[i]!;
    text(page, e.estilo, MARGIN + 8, y, 8, font);
    text(page, fmtInt(e.pares), PAGE_W - MARGIN - 48, y, 8, fontBold, MUTED);
    y -= 11;
  }
  y -= 14;

  const COLS = 2;
  const gap = 12;
  const cellW = (PAGE_W - MARGIN * 2 - gap) / COLS;
  const imgH = 72;
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

  for (const card of cards) {
    const preciosVis = card.precios.slice(0, MAX_PRECIOS_VISIBLE);
    let bodyH = 0;
    for (const pb of preciosVis) {
      const nT = Math.min(pb.tallas.length, MAX_TALLAS_POR_PRECIO);
      bodyH += 14 + nT * 12 + (pb.tallas.length > MAX_TALLAS_POR_PRECIO ? 10 : 0);
    }
    if (card.precios.length > MAX_PRECIOS_VISIBLE) bodyH += 10;
    const cellH = imgH + 40 + bodyH + 18;
    ensureSpace(cellH + 4);

    if (col === 0) rowMaxH = cellH;
    else rowMaxH = Math.max(rowMaxH, cellH);

    const x = MARGIN + col * (cellW + gap);
    const top = y;
    const r = card.row;

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
      text(page, "S/IMG", x + 8, top - 40, 9, font, MUTED);
    }

    let ly = top - imgH - 12;
    text(page, `${r.linea}-${r.referencia}`, x + 5, ly, 9, fontBold);
    ly -= 11;
    const imgName = r.imagenNombre || basenameImagen(r.imagen_url, r.color);
    text(page, `img: ${imgName}`.slice(0, 42), x + 5, ly, 6.5, font, MUTED);
    ly -= 10;
    text(
      page,
      `${r.descpMaterial || r.material} · ${r.descpColor || r.color}`.slice(0, 46),
      x + 5,
      ly,
      7,
      font,
    );
    ly -= 12;

    for (const pb of preciosVis) {
      page.drawRectangle({
        x: x + 4,
        y: ly - 2,
        width: cellW - 8,
        height: 12,
        color: PRICE_BG,
      });
      text(page, `${fmtMoney(pb.precio)} /p`, x + 6, ly, 7.5, fontBold);
      text(
        page,
        `${fmtInt(pb.prendas)} prend`,
        x + cellW - 52,
        ly,
        6.5,
        font,
        MUTED,
      );
      ly -= 14;

      const tallasVis = pb.tallas.slice(0, MAX_TALLAS_POR_PRECIO);
      for (const t of tallasVis) {
        // talle | cantidad
        page.drawRectangle({
          x: x + 6,
          y: ly - 2,
          width: cellW * 0.45,
          height: 11,
          borderColor: RULE,
          borderWidth: 0.35,
        });
        text(page, `T ${t.talle}`, x + 9, ly, 7, font);
        page.drawRectangle({
          x: x + cellW - 36,
          y: ly - 2,
          width: 28,
          height: 11,
          borderColor: RULE,
          borderWidth: 0.35,
          color: QTY_BG,
        });
        const q = fmtInt(t.prendas);
        const qW = fontBold.widthOfTextAtSize(q, 7);
        text(page, q, x + cellW - 36 + (28 - qW) / 2, ly, 7, fontBold);
        ly -= 12;
      }
      if (pb.tallas.length > MAX_TALLAS_POR_PRECIO) {
        text(
          page,
          `+${pb.tallas.length - MAX_TALLAS_POR_PRECIO} tallas…`,
          x + 6,
          ly,
          6,
          font,
          MUTED,
        );
        ly -= 10;
      }
    }
    if (card.precios.length > MAX_PRECIOS_VISIBLE) {
      text(
        page,
        `+${card.precios.length - MAX_PRECIOS_VISIBLE} precios…`,
        x + 5,
        ly,
        6,
        font,
        MUTED,
      );
      ly -= 10;
    }

    text(page, `${fmtInt(card.prendas)} prendas`, x + 5, ly, 8, fontBold);

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
    totalPares: totalPrendas,
    estilos: estilos.length,
  };
}
