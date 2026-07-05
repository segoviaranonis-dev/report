import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import { normalizeGradaLabel } from "@/lib/depositos/grada-operativa";

export type TallaPares = {
  talla: string;
  pares: number;
};

export type TonoDrill = {
  tono: string;
  totalPares: number;
  tallas: TallaPares[];
};

export type EstiloDrill = {
  estilo: string;
  totalPares: number;
  tonos: TonoDrill[];
};

export type MarcaEnEstiloDrill = {
  marca: string;
  totalPares: number;
  tallas: TallaPares[];
};

export type EstiloMarcaDrill = {
  estilo: string;
  totalPares: number;
  marcas: MarcaEnEstiloDrill[];
};

function marcaLabel(r: DepositoRow): string {
  return r.marca?.trim() || "Sin marca";
}

function tonoLabel(r: DepositoRow): string {
  const t = r.tono_etiqueta?.trim();
  if (t) return t;
  const d = r.descp_color?.trim();
  if (d) return d;
  return "Sin tono";
}

function estiloLabel(r: DepositoRow): string {
  return r.estilo?.trim() || "Sin estilo";
}

function sortTallas(a: TallaPares, b: TallaPares): number {
  const na = Number(a.talla.split("/")[0]);
  const nb = Number(b.talla.split("/")[0]);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return a.talla.localeCompare(b.talla, "es");
}

/** Estilo → tono → talla (pares) desde filas depósito Report. */
export function buildEstiloTonoDrillFromRows(rows: DepositoRow[]): EstiloDrill[] {
  type TonoMap = Map<string, Map<string, number>>;
  const estilos = new Map<string, { tonos: TonoMap; total: number }>();

  for (const r of rows) {
    const p = r.cantidad ?? 0;
    if (p <= 0) continue;

    const est = estiloLabel(r);
    const ton = tonoLabel(r);
    const talla = normalizeGradaLabel(r.grada) || r.grada?.trim() || "Sin talla";

    let e = estilos.get(est);
    if (!e) {
      e = { tonos: new Map(), total: 0 };
      estilos.set(est, e);
    }
    e.total += p;

    let tMap = e.tonos.get(ton);
    if (!tMap) {
      tMap = new Map();
      e.tonos.set(ton, tMap);
    }
    tMap.set(talla, (tMap.get(talla) ?? 0) + p);
  }

  return [...estilos.entries()]
    .map(([estilo, data]) => {
      const tonos: TonoDrill[] = [...data.tonos.entries()]
        .map(([tono, tallaMap]) => {
          const tallas = [...tallaMap.entries()]
            .map(([talla, pares]) => ({ talla, pares }))
            .sort(sortTallas);
          const totalPares = tallas.reduce((s, t) => s + t.pares, 0);
          return { tono, totalPares, tallas };
        })
        .sort((a, b) => b.totalPares - a.totalPares);
      return { estilo, totalPares: data.total, tonos };
    })
    .sort((a, b) => b.totalPares - a.totalPares);
}

/** Estilo → marca → talla (pares) desde filas depósito Report. */
export function buildEstiloMarcaDrillFromRows(rows: DepositoRow[]): EstiloMarcaDrill[] {
  type MarcaMap = Map<string, Map<string, number>>;
  const estilos = new Map<string, { marcas: MarcaMap; total: number }>();

  for (const r of rows) {
    const p = r.cantidad ?? 0;
    if (p <= 0) continue;

    const est = estiloLabel(r);
    const mar = marcaLabel(r);
    const talla = normalizeGradaLabel(r.grada) || r.grada?.trim() || "Sin talla";

    let e = estilos.get(est);
    if (!e) {
      e = { marcas: new Map(), total: 0 };
      estilos.set(est, e);
    }
    e.total += p;

    let mMap = e.marcas.get(mar);
    if (!mMap) {
      mMap = new Map();
      e.marcas.set(mar, mMap);
    }
    mMap.set(talla, (mMap.get(talla) ?? 0) + p);
  }

  return [...estilos.entries()]
    .map(([estilo, data]) => {
      const marcas: MarcaEnEstiloDrill[] = [...data.marcas.entries()]
        .map(([marca, tallaMap]) => {
          const tallas = [...tallaMap.entries()]
            .map(([talla, pares]) => ({ talla, pares }))
            .sort(sortTallas);
          const totalPares = tallas.reduce((s, t) => s + t.pares, 0);
          return { marca, totalPares, tallas };
        })
        .sort((a, b) => b.totalPares - a.totalPares);
      return { estilo, totalPares: data.total, marcas };
    })
    .sort((a, b) => b.totalPares - a.totalPares);
}
