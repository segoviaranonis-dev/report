import {
  productImageCandidatesForRow,
} from "@/lib/retail/product-image";
import type { ColumnaStockRetail, ImportadoraBloque, TiendaTallaBloque } from "@/lib/retail/types";
import type { RetailStagingRow } from "@/lib/retail/staging-row";

const GRADIENTS = [
  "bg-gradient-to-br from-bazzar-naranja/40 via-bazzar-naranja to-bazzar-naranja-dark",
  "bg-gradient-to-br from-amber-100 via-amber-300 to-amber-900",
  "bg-gradient-to-br from-bazzar-naranja/30 via-bazzar-naranja-dark to-rimec-azul-dark",
  "bg-gradient-to-br from-sky-200 via-cyan-600 to-slate-900",
  "bg-gradient-to-br from-emerald-200 via-teal-700 to-slate-950",
  "bg-gradient-to-br from-rose-200 via-rose-600 to-slate-900",
];

function normSkuKey(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function normCodigo(v: unknown): string {
  return String(v ?? "")
    .trim()
    .replace(/\s+/g, "");
}

function tipoNorm(t: string): string {
  return t.trim().toLowerCase();
}

function gradaSortKey(g: string): [number, number, string] {
  const s = g.trim();
  if (!s || s.toLowerCase() === "(sin grada)") return [9999, 9999, s];
  const m = /^(\d+)/.exec(s);
  if (m) return [0, Number(m[1]), s];
  return [1, 0, s];
}

function origenIsImportadora(name: string): boolean {
  const nl = name.toLowerCase().trim();
  return nl.includes("import") || nl === "rimec" || nl.includes("rimec");
}

function gradaEsCajaCurvaImportadora(g: string): boolean {
  const s = g.trim();
  if (!s || s.toLowerCase().includes("sin grada")) return false;
  return s.includes("(") && s.includes(")");
}

function gradasVisiblesParaOrigen(origen: string, gradasOrden: string[]): string[] {
  const esImp = origenIsImportadora(origen);
  return gradasOrden.filter((g) => {
    const curva = gradaEsCajaCurvaImportadora(g);
    return esImp ? curva : !curva;
  });
}

function origenesOrdered(origenes: string[]): string[] {
  const names = [...new Set(origenes.map((o) => o.trim()).filter(Boolean))].sort();
  const tiendas = names.filter((n) => !origenIsImportadora(n));
  const imp = names.filter((n) => origenIsImportadora(n));
  const natKey = (label: string) =>
    label.split(/(\d+)/).map((p) => (p.match(/^\d+$/) ? Number(p) : p.toLowerCase()));
  tiendas.sort((a, b) => {
    const ka = natKey(a);
    const kb = natKey(b);
    for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
      if (ka[i] !== kb[i]) return String(ka[i]).localeCompare(String(kb[i]), "es");
    }
    return 0;
  });
  imp.sort((a, b) => a.localeCompare(b, "es"));
  return [...tiendas, ...imp];
}

type AlbumBlock = {
  origen: string;
  gradas: string[];
  venta: Record<string, number>;
  stock: Record<string, number>;
};

function albumGradaSummaryForSku(rows: RetailStagingRow[], skuKey: string): AlbumBlock[] | null {
  const sku = normSkuKey(skuKey);
  if (!sku) return null;
  const sub = rows.filter((r) => normSkuKey(r.sku_key) === sku);
  if (!sub.length) return null;

  const gradasSorted = [
    ...new Set(sub.map((r) => String(r.grada ?? "").trim()).filter(Boolean)),
  ].sort((a, b) => {
    const ka = gradaSortKey(a);
    const kb = gradaSortKey(b);
    if (ka[0] !== kb[0]) return ka[0] - kb[0];
    if (ka[1] !== kb[1]) return ka[1] - kb[1];
    return ka[2].localeCompare(kb[2], "es");
  });
  if (!gradasSorted.length) return null;

  const blocks: AlbumBlock[] = [];
  for (const origen of origenesOrdered(sub.map((r) => r.origen_tienda))) {
    const colKeys = gradasVisiblesParaOrigen(origen, gradasSorted);
    if (!colKeys.length) continue;

    const so = sub.filter((r) => r.origen_tienda.trim() === origen);
    const vent = so.filter((r) => tipoNorm(r.tipo_movimiento) === "venta");
    const stk = so.filter((r) => tipoNorm(r.tipo_movimiento) === "stock");
    if (!vent.length && !stk.length) continue;

    const venta: Record<string, number> = {};
    const stock: Record<string, number> = {};

    for (const g of colKeys) {
      venta[g] = vent
        .filter((r) => String(r.grada).trim() === g)
        .reduce((s, r) => s + Number(r.cantidad) || 0, 0);
    }

    if (stk.length) {
      const maxFecha = stk.reduce((m, r) => (r.fecha_mov > m ? r.fecha_mov : m), stk[0]!.fecha_mov);
      const slast = stk.filter((r) => r.fecha_mov === maxFecha);
      for (const g of colKeys) {
        stock[g] = slast
          .filter((r) => String(r.grada).trim() === g)
          .reduce((s, r) => s + Number(r.cantidad) || 0, 0);
      }
    } else {
      for (const g of colKeys) stock[g] = 0;
    }

    blocks.push({ origen, gradas: colKeys, venta, stock });
  }

  return blocks.length ? blocks : null;
}

function imagenClassForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length]!;
}

function blockToTienda(b: AlbumBlock, displayName: string): TiendaTallaBloque {
  return {
    nombre: displayName,
    tallas: b.gradas,
    venta: b.gradas.map((g) => {
      const v = b.venta[g] ?? 0;
      return v === 0 ? null : v;
    }),
    stock: b.gradas.map((g) => b.stock[g] ?? 0),
  };
}

function blockToImportadora(b: AlbumBlock): ImportadoraBloque {
  const etiquetaGrada = b.gradas.length === 1 ? b.gradas[0]! : b.gradas.join(" · ");
  const stockTotal = b.gradas.reduce((s, g) => s + (b.stock[g] ?? 0), 0);
  return { etiquetaGrada, stockTotal };
}

function blockToColumnaByImagen(
  imagenKey: string,
  imagenDisplay: string,
  totalVenta: number,
  ranking: number,
  meta: RetailStagingRow,
  tiendaBlocks: AlbumBlock[],
  impBlock: AlbumBlock | undefined,
  ventaPorTienda: { tienda: string; pares: number }[],
): ColumnaStockRetail {
  const marca = meta.marca?.trim() || "(sin marca)";
  const mat = meta.descp_material?.trim();
  const col = meta.descp_color?.trim();
  const pilarHint = mat || col ? ` · ${[mat, col].filter(Boolean).join(" / ")}` : "";
  const etiqueta = `L${normCodigo(meta.linea_codigo_proveedor)} R${normCodigo(meta.referencia_codigo_proveedor)} - ${Math.round(totalVenta)} pares venta ${marca}${pilarHint}`;

  const cardId = imagenKey.replace(/[^a-z0-9.-]+/gi, "_");
  const cands = productImageCandidatesForRow(
    meta.linea_codigo_proveedor,
    meta.referencia_codigo_proveedor,
    meta.material_code,
    meta.color_code,
    imagenDisplay,
  );

  return {
    id: cardId,
    imagenArchivo: imagenDisplay,
    totalVenta,
    ranking,
    ventaPorTienda,
    origenLabel: "VENTA",
    origenRaw: "",
    esImportadora: false,
    etiqueta,
    imagenClass: imagenClassForId(cardId),
    imageCandidates: cands,
    imageSrc: cands[0],
    imageSearchName: imagenDisplay,
    tiendas: tiendaBlocks.map((b) => blockToTienda(b, b.origen.trim())),
    importadora: impBlock ? blockToImportadora(impBlock) : { etiquetaGrada: "—", stockTotal: 0 },
  };
}

function normImagenKey(name: string | null | undefined): string {
  return String(name ?? "")
    .trim()
    .replace(/^productos\//i, "")
    .toLowerCase();
}

function displayImagenFile(name: string): string {
  return String(name).trim().replace(/^productos\//i, "");
}

function rankVentasByImagen(
  rows: RetailStagingRow[],
): { imagenKey: string; imagenDisplay: string; totalVenta: number }[] {
  const map = new Map<string, { display: string; total: number }>();
  for (const r of rows) {
    if (tipoNorm(r.tipo_movimiento) !== "venta") continue;
    const qty = Number(r.cantidad) || 0;
    if (qty <= 0) continue;
    const key = normImagenKey(r.imagen_nombre);
    if (!key) continue;
    const display = displayImagenFile(r.imagen_nombre!);
    const prev = map.get(key);
    if (!prev) map.set(key, { display, total: qty });
    else prev.total += qty;
  }
  return [...map.entries()]
    .map(([imagenKey, { display, total }]) => ({
      imagenKey,
      imagenDisplay: display,
      totalVenta: Math.round(total),
    }))
    .sort((a, b) => b.totalVenta - a.totalVenta);
}

const TIENDAS_BAZZAR_ORDEN = ["Fernando", "Palma", "San Martin"];

function ventaPorTiendaSummary(
  rows: RetailStagingRow[],
  imagenKey: string,
): { tienda: string; pares: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (normImagenKey(r.imagen_nombre) !== imagenKey) continue;
    if (tipoNorm(r.tipo_movimiento) !== "venta") continue;
    const qty = Number(r.cantidad) || 0;
    if (qty <= 0) continue;
    if (origenIsImportadora(r.origen_tienda)) continue;
    const t = r.origen_tienda.trim();
    map.set(t, (map.get(t) ?? 0) + qty);
  }
  const out: { tienda: string; pares: number }[] = [];
  for (const name of TIENDAS_BAZZAR_ORDEN) {
    const p = map.get(name);
    if (p && p > 0) out.push({ tienda: name, pares: Math.round(p) });
  }
  for (const [tienda, pares] of map) {
    if (TIENDAS_BAZZAR_ORDEN.includes(tienda)) continue;
    if (pares > 0) out.push({ tienda, pares: Math.round(pares) });
  }
  return out;
}

export function buildStockBoardFromStaging(
  rows: RetailStagingRow[],
  topN = 30,
): ColumnaStockRetail[] {
  const ranked = rankVentasByImagen(rows);
  const out: ColumnaStockRetail[] = [];

  ranked.slice(0, topN).forEach(({ imagenKey, imagenDisplay, totalVenta }, idx) => {
    const sub = rows.filter((r) => normImagenKey(r.imagen_nombre) === imagenKey);
    const meta = sub.find((r) => r.pilares_ok) ?? sub[0];
    if (!meta) return;

    const skuKey = normSkuKey(meta.sku_key);
    const blocks = skuKey ? albumGradaSummaryForSku(rows, skuKey) : null;
    const tiendaBlocks = (blocks ?? []).filter((b) => !origenIsImportadora(b.origen));
    const impBlock = (blocks ?? []).find((b) => origenIsImportadora(b.origen));

    out.push(
      blockToColumnaByImagen(
        imagenKey,
        imagenDisplay,
        totalVenta,
        idx + 1,
        meta,
        tiendaBlocks,
        impBlock,
        ventaPorTiendaSummary(rows, imagenKey),
      ),
    );
  });

  return out;
}

export function summarizePilares(rows: RetailStagingRow[]): {
  filasOk: number;
  filasPendientes: number;
  mensaje: string;
} {
  const total = rows.length;
  const ok = rows.filter((r) => r.pilares_ok).length;
  const pend = total - ok;
  const mensaje =
    pend === 0
      ? `Las ${total} filas del lote resuelven FK de línea, referencia, material y color en pilares.`
      : `${pend} de ${total} filas sin FK completa (revisar códigos amarillos o ejecutar refresh FK en Streamlit).`;
  return { filasOk: ok, filasPendientes: pend, mensaje };
}

export function computeRetailKpis(rows: RetailStagingRow[]): {
  paresEnRed: number;
  referenciasActivas: number;
  paresImportadora: number;
  paresVentaTotal: number;
  filasStaging: number;
  filasPilaresOk: number;
  filasPilaresPendientes: number;
} {
  const skus = new Set<string>();
  let paresEnRed = 0;
  let paresImportadora = 0;
  let paresVentaTotal = 0;

  const stockByOrigenSku = new Map<string, Map<string, { fecha: string; qty: number }>>();

  for (const r of rows) {
    const sku = normSkuKey(r.sku_key);
    if (sku) skus.add(sku);
    const tipo = tipoNorm(r.tipo_movimiento);
    const qty = Number(r.cantidad) || 0;
    const origen = r.origen_tienda.trim();

    if (tipo === "venta") {
      paresVentaTotal += qty;
    }

    if (tipo === "stock") {
      const key = `${origen}::${sku}`;
      let m = stockByOrigenSku.get(key);
      if (!m) {
        m = new Map();
        stockByOrigenSku.set(key, m);
      }
      const g = String(r.grada).trim();
      const prev = m.get(g);
      if (!prev || r.fecha_mov >= prev.fecha) {
        m.set(g, { fecha: r.fecha_mov, qty });
      }
    }
  }

  for (const [key, gradas] of stockByOrigenSku) {
    const origen = key.split("::")[0] ?? "";
    const total = [...gradas.values()].reduce((s, x) => s + x.qty, 0);
    if (origenIsImportadora(origen)) paresImportadora += total;
    else paresEnRed += total;
  }

  const pil = summarizePilares(rows);
  return {
    paresEnRed: Math.round(paresEnRed),
    referenciasActivas: skus.size,
    paresImportadora: Math.round(paresImportadora),
    paresVentaTotal: Math.round(paresVentaTotal),
    filasStaging: rows.length,
    filasPilaresOk: pil.filasOk,
    filasPilaresPendientes: pil.filasPendientes,
  };
}
