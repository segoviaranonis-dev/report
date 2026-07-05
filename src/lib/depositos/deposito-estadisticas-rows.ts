import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import type { StatSlice } from "@/lib/depositos/deposito-estadisticas-charts";
import { normalizeGradaLabel, sortGradaLabels } from "@/lib/depositos/grada-operativa";
import { tonoEfectivo } from "@/lib/depositos/operativa-filters";

function moleculeKey(r: DepositoRow): string {
  return `${r.linea_codigo_proveedor}-${r.referencia_codigo_proveedor}-${r.material_code}-${r.color_code}`;
}

export function agregarPorCampoFromRows(
  rows: DepositoRow[],
  getLabel: (r: DepositoRow) => string,
  top = 8,
): StatSlice[] {
  const map = new Map<string, { pares: number; cajas: Set<string> }>();

  for (const r of rows) {
    const label = getLabel(r) || "Sin dato";
    const prev = map.get(label) ?? { pares: 0, cajas: new Set<string>() };
    prev.pares += r.cantidad ?? 0;
    prev.cajas.add(moleculeKey(r));
    map.set(label, prev);
  }

  const rowsOut = [...map.entries()].map(([label, s]) => ({
    label,
    pares: s.pares,
    cajas: s.cajas.size,
    value: s.pares,
    pct: 0,
  }));

  rowsOut.sort((a, b) => b.value - a.value);
  const topRows = rowsOut.slice(0, top);
  const otros = rowsOut.slice(top);
  if (otros.length > 0) {
    topRows.push({
      label: "Otros",
      pares: otros.reduce((s, r) => s + r.pares, 0),
      cajas: otros.reduce((s, r) => s + r.cajas, 0),
      value: otros.reduce((s, r) => s + r.value, 0),
      pct: 0,
    });
  }

  const total = topRows.reduce((s, r) => s + r.value, 0);
  for (const r of topRows) {
    r.pct = total > 0 ? Math.round((r.value / total) * 1000) / 10 : 0;
  }
  return topRows;
}

/** Todas las gradas N° · pares y cajas · orden numérico. */
export function agregarPorGradaFromRows(rows: DepositoRow[]): StatSlice[] {
  const map = new Map<string, { pares: number; cajas: Set<string> }>();

  for (const r of rows) {
    const p = r.cantidad ?? 0;
    if (p <= 0) continue;
    const label = normalizeGradaLabel(r.grada) || r.grada?.trim() || "Sin grada";
    const prev = map.get(label) ?? { pares: 0, cajas: new Set<string>() };
    prev.pares += p;
    prev.cajas.add(moleculeKey(r));
    map.set(label, prev);
  }

  const rowsOut = [...map.entries()].map(([label, s]) => ({
    label,
    pares: s.pares,
    cajas: s.cajas.size,
    value: s.pares,
    pct: 0,
  }));

  rowsOut.sort((a, b) => sortGradaLabels(a.label, b.label));
  const total = rowsOut.reduce((s, r) => s + r.value, 0);
  for (const r of rowsOut) {
    r.pct = total > 0 ? Math.round((r.value / total) * 1000) / 10 : 0;
  }
  return rowsOut;
}

export type EstiloEnMarca = {
  estilo: string;
  totalPares: number;
};

export type MarcaDrill = {
  marca: string;
  totalPares: number;
  estilos: EstiloEnMarca[];
};

export function buildMarcaEstiloDrillFromRows(rows: DepositoRow[]): MarcaDrill[] {
  const marcas = new Map<string, Map<string, number>>();

  for (const r of rows) {
    const p = r.cantidad ?? 0;
    if (p <= 0) continue;
    const marca = r.marca?.trim() || "Sin marca";
    const estilo = r.estilo?.trim() || "Sin estilo";
    let estMap = marcas.get(marca);
    if (!estMap) {
      estMap = new Map();
      marcas.set(marca, estMap);
    }
    estMap.set(estilo, (estMap.get(estilo) ?? 0) + p);
  }

  return [...marcas.entries()]
    .map(([marca, estMap]) => {
      const estilos = [...estMap.entries()]
        .map(([estilo, totalPares]) => ({ estilo, totalPares }))
        .sort((a, b) => b.totalPares - a.totalPares);
      const totalPares = estilos.reduce((s, e) => s + e.totalPares, 0);
      return { marca, totalPares, estilos };
    })
    .sort((a, b) => b.totalPares - a.totalPares);
}

export function tonoLabelRow(r: DepositoRow): string {
  return tonoEfectivo(r)?.trim() || "Sin tono";
}
