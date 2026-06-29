import type { DepositoFilterItem } from "@/app/api/depositos/[cliente_id]/filtros/route";
import type { ConfeccionRow } from "@/app/api/depositos/[cliente_id]/operativa/confecciones/route";
import { normFk } from "@/lib/depositos/operativa-filters";

export type ConfeccionesFilterState = {
  marcaIds: number[];
  lineaIds: number[];
  referenciaIds: number[];
  colorIds: number[];
  gradas: string[];
  q: string;
};

export const EMPTY_CONFECCIONES_FILTERS: ConfeccionesFilterState = {
  marcaIds: [],
  lineaIds: [],
  referenciaIds: [],
  colorIds: [],
  gradas: [],
  q: "",
};

export function parseConfeccionesFiltersFromSearchParams(
  sp: URLSearchParams,
): ConfeccionesFilterState {
  const ids = (key: string) =>
    sp
      .getAll(key)
      .concat((sp.get(key) ?? "").split(","))
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isFinite(n));

  const gradas = sp
    .getAll("grada")
    .concat((sp.get("grada") ?? "").split(","))
    .map((g) => g.trim())
    .filter(Boolean);

  return {
    marcaIds: ids("marca_id"),
    lineaIds: ids("linea_id"),
    referenciaIds: ids("referencia_id"),
    colorIds: ids("color_id"),
    gradas,
    q: sp.get("q") ?? "",
  };
}

export function confeccionesFiltersToSearchParams(f: ConfeccionesFilterState): URLSearchParams {
  const p = new URLSearchParams();
  for (const id of f.marcaIds) p.append("marca_id", String(id));
  for (const id of f.lineaIds) p.append("linea_id", String(id));
  for (const id of f.referenciaIds) p.append("referencia_id", String(id));
  for (const id of f.colorIds) p.append("color_id", String(id));
  for (const g of f.gradas) p.append("grada", g);
  if (f.q.trim()) p.set("q", f.q.trim());
  return p;
}

function matchFk(rowVal: unknown, selected: number[]): boolean {
  if (!selected.length) return true;
  const n = normFk(rowVal);
  return n != null && selected.includes(n);
}

export function hayFiltrosConfeccionesActivos(f: ConfeccionesFilterState): boolean {
  return (
    f.marcaIds.length > 0 ||
    f.lineaIds.length > 0 ||
    f.referenciaIds.length > 0 ||
    f.colorIds.length > 0 ||
    f.gradas.length > 0 ||
    !!f.q.trim()
  );
}

export type ConfeccionesFilterKey = keyof ConfeccionesFilterState;

function emptyForExcluir(excluir: ConfeccionesFilterKey): ConfeccionesFilterState[ConfeccionesFilterKey] {
  if (excluir === "q") return "";
  return [];
}

export function applyConfeccionesFilters(
  rows: ConfeccionRow[],
  f: ConfeccionesFilterState,
  excluir?: ConfeccionesFilterKey,
): ConfeccionRow[] {
  const eff: ConfeccionesFilterState = excluir
    ? { ...f, [excluir]: emptyForExcluir(excluir) }
    : f;

  let out = rows.filter((r) => r.cantidad > 0);

  if (eff.marcaIds.length) out = out.filter((r) => matchFk(r.marca_id, eff.marcaIds));
  if (eff.lineaIds.length) out = out.filter((r) => matchFk(r.linea_id, eff.lineaIds));
  if (eff.referenciaIds.length) out = out.filter((r) => matchFk(r.referencia_id, eff.referenciaIds));
  if (eff.colorIds.length) out = out.filter((r) => matchFk(r.color_id, eff.colorIds));
  if (eff.gradas.length) {
    const set = new Set(eff.gradas.map((g) => g.trim()));
    out = out.filter((r) => set.has(r.grada.trim()));
  }

  const q = eff.q.trim().toLowerCase();
  if (q) {
    out = out.filter((r) =>
      [
        r.marca,
        r.linea_codigo_proveedor,
        r.referencia_codigo_proveedor,
        r.material_code,
        r.color_code,
        r.descp_material,
        r.descp_color,
        r.imagen_nombre,
        r.grada,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }

  return out;
}

export type ConfeccionesOpciones = {
  marcas: DepositoFilterItem[];
  lineas: DepositoFilterItem[];
  referencias: DepositoFilterItem[];
  colores: DepositoFilterItem[];
  gradas: string[];
};

function uniqItems(
  rows: ConfeccionRow[],
  idKey: keyof ConfeccionRow,
  labelFn: (r: ConfeccionRow) => string,
): DepositoFilterItem[] {
  const map = new Map<number, DepositoFilterItem>();
  for (const r of rows) {
    const n = normFk(r[idKey]);
    if (n == null) continue;
    if (!map.has(n)) map.set(n, { id: n, label: labelFn(r) });
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "es"));
}

export function buildConfeccionesOpciones(
  rows: ConfeccionRow[],
  filtros: ConfeccionesFilterState,
): ConfeccionesOpciones {
  const base = (excluir: ConfeccionesFilterKey) => applyConfeccionesFilters(rows, filtros, excluir);

  const gradas = Array.from(
    new Set(base("gradas").map((r) => r.grada.trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "es", { numeric: true }));

  return {
    marcas: uniqItems(base("marcaIds"), "marca_id", (r) => r.marca),
    lineas: uniqItems(base("lineaIds"), "linea_id", (r) => {
      const desc = r.descp_linea?.trim();
      return desc ? `${r.linea_codigo_proveedor} · ${desc}` : r.linea_codigo_proveedor;
    }),
    referencias: uniqItems(base("referenciaIds"), "referencia_id", (r) => r.referencia_codigo_proveedor),
    colores: uniqItems(base("colorIds"), "color_id", (r) => {
      const desc = r.descp_color?.trim();
      const code = r.color_code?.trim();
      if (desc && code) return `${code} · ${desc}`;
      return desc || code || String(r.color_id);
    }),
    gradas,
  };
}
