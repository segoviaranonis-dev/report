import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import type { DepositoFilterItem } from "@/app/api/depositos/[cliente_id]/filtros/route";
import { colorPredominante } from "@/lib/pilares/color-canon";

export type CantidadOp = "gt" | "lt" | null;

export type OperativaFilterState = {
  generoIds: number[];
  marcaIds: number[];
  grupoEstiloIds: number[];
  tipo1Ids: number[];
  tipoV2Ids: number[];
  lineaIds: number[];
  tonos: string[];
  sinTono: boolean;
  q: string;
  /** Mayor/menor que — pares totales o en gradas seleccionadas */
  cantidadOp: CantidadOp;
  cantidadValor: number | null;
  /** Códigos grada (talla) — multi-select */
  gradas: string[];
};

export type ExcluirDimension = keyof OperativaFilterState;

export const EMPTY_OPERATIVA_FILTERS: OperativaFilterState = {
  generoIds: [],
  marcaIds: [],
  grupoEstiloIds: [],
  tipo1Ids: [],
  tipoV2Ids: [],
  lineaIds: [],
  tonos: [],
  sinTono: false,
  q: "",
  cantidadOp: null,
  cantidadValor: null,
  gradas: [],
};

/** node-pg devuelve bigint como string — normalizar siempre. */
export function normFk(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function normalizeDepositoRow(r: DepositoRow): DepositoRow {
  return {
    ...r,
    genero_id: normFk(r.genero_id),
    marca_id: normFk(r.marca_id),
    grupo_estilo_id: normFk(r.grupo_estilo_id),
    tipo_1_id: normFk(r.tipo_1_id),
    tipo_v2_id: normFk(r.tipo_v2_id),
    linea_id: normFk(r.linea_id),
    referencia_id: normFk(r.referencia_id),
    material_id: normFk(r.material_id) ?? r.material_id,
    color_id: normFk(r.color_id) ?? r.color_id,
    tono_etiqueta: r.tono_etiqueta?.trim() || null,
  };
}

function matchFk(rowVal: unknown, selected: number[]): boolean {
  if (!selected.length) return true;
  const n = normFk(rowVal);
  return n != null && selected.includes(n);
}

/** Tono para filtro: canon primero, fallback texto color. */
export function tonoEfectivo(r: DepositoRow): string | null {
  if (r.tono_etiqueta) return r.tono_etiqueta;
  const pred = colorPredominante(r.descp_color);
  return pred || null;
}

export function toggleOperativaId(list: number[], id: number | string): number[] {
  const n = normFk(id);
  if (n == null) return list;
  return list.includes(n) ? list.filter((x) => x !== n) : [...list, n];
}

export function toggleOperativaLabel(list: string[], label: string): string[] {
  return list.includes(label) ? list.filter((x) => x !== label) : [...list, label];
}

export function hayFiltrosActivos(f: OperativaFilterState): boolean {
  return (
    f.generoIds.length > 0 ||
    f.marcaIds.length > 0 ||
    f.grupoEstiloIds.length > 0 ||
    f.tipo1Ids.length > 0 ||
    f.tipoV2Ids.length > 0 ||
    f.lineaIds.length > 0 ||
    f.tonos.length > 0 ||
    f.sinTono ||
    !!f.q.trim() ||
    f.gradas.length > 0 ||
    (f.cantidadOp != null && f.cantidadValor != null)
  );
}

function moleculeKeyOperativa(p: DepositoRow): string {
  return `${p.linea_codigo_proveedor}-${p.referencia_codigo_proveedor}-${p.material_code}-${p.color_code}`;
}

function parseGradaOperativa(grada: string): string {
  return grada.trim();
}

function sortGradaLabels(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return a.localeCompare(b, "es");
}

/** Filtra moléculas por pares totales o por suma en gradas elegidas. */
function applyCantidadGradaFilter(rows: DepositoRow[], f: OperativaFilterState): DepositoRow[] {
  const hasCantidad = f.cantidadOp != null && f.cantidadValor != null;
  const hasGradas = f.gradas.length > 0;
  if (!hasCantidad && !hasGradas) return rows;

  const groups = new Map<string, DepositoRow[]>();
  for (const r of rows) {
    const k = moleculeKeyOperativa(r);
    const list = groups.get(k);
    if (list) list.push(r);
    else groups.set(k, [r]);
  }

  const kept = new Set<string>();
  for (const [key, items] of groups) {
    const stockByGrada = new Map<string, number>();
    for (const item of items) {
      const g = parseGradaOperativa(item.grada);
      stockByGrada.set(g, (stockByGrada.get(g) ?? 0) + item.cantidad);
    }

    if (hasGradas) {
      const tieneStock = f.gradas.some((g) => (stockByGrada.get(g) ?? 0) > 0);
      if (!tieneStock) continue;
    }

    const paresTotal = items.reduce((s, i) => s + i.cantidad, 0);

    if (hasCantidad && f.cantidadValor != null && f.cantidadOp) {
      if (f.cantidadOp === "gt" && !(paresTotal > f.cantidadValor)) continue;
      if (f.cantidadOp === "lt" && !(paresTotal < f.cantidadValor)) continue;
    }

    kept.add(key);
  }

  return rows.filter((r) => kept.has(moleculeKeyOperativa(r)));
}

export function listGradasOperativa(rows: DepositoRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    const g = parseGradaOperativa(r.grada);
    if (g) set.add(g);
  }
  return Array.from(set).sort(sortGradaLabels);
}

function emptyForExcluir(excluir: ExcluirDimension): OperativaFilterState[ExcluirDimension] {
  if (excluir === "sinTono") return false;
  if (excluir === "q") return "";
  if (excluir === "cantidadOp") return null;
  if (excluir === "cantidadValor") return null;
  return [];
}

export function applyOperativaFilters(
  rows: DepositoRow[],
  f: OperativaFilterState,
  excluir?: ExcluirDimension,
): DepositoRow[] {
  const eff: OperativaFilterState = excluir
    ? { ...f, [excluir]: emptyForExcluir(excluir) }
    : f;

  let out = rows.filter((r) => r.cantidad > 0);

  if (eff.generoIds.length) {
    out = out.filter((r) => matchFk(r.genero_id, eff.generoIds));
  }
  if (eff.marcaIds.length) {
    out = out.filter((r) => matchFk(r.marca_id, eff.marcaIds));
  }
  if (eff.grupoEstiloIds.length) {
    out = out.filter((r) => matchFk(r.grupo_estilo_id, eff.grupoEstiloIds));
  }
  if (eff.tipo1Ids.length) {
    out = out.filter((r) => matchFk(r.tipo_1_id, eff.tipo1Ids));
  }
  if (eff.tipoV2Ids.length) {
    out = out.filter((r) => matchFk(r.tipo_v2_id, eff.tipoV2Ids));
  }
  if (eff.lineaIds.length) {
    out = out.filter((r) => matchFk(r.linea_id, eff.lineaIds));
  }
  if (eff.sinTono) {
    out = out.filter((r) => !tonoEfectivo(r));
  } else if (eff.tonos.length) {
    const set = new Set(eff.tonos.map((t) => t.toLowerCase()));
    out = out.filter((r) => {
      const te = tonoEfectivo(r);
      if (!te) return false;
      const low = te.toLowerCase();
      return set.has(low) || [...set].some((t) => low.includes(t));
    });
  }

  const q = eff.q.trim().toLowerCase();
  if (q) {
    out = out.filter((r) =>
      [
        r.marca,
        r.linea_codigo_proveedor,
        r.referencia_codigo_proveedor,
        r.estilo,
        r.descp_material,
        r.descp_color,
        r.tono_etiqueta,
        tonoEfectivo(r),
        r.tipo_v2,
        r.genero,
        r.tipo_1,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }

  if (!excluir) {
    return applyCantidadGradaFilter(out, eff);
  }
  return out;
}

export type OperativaOpciones = {
  generos: DepositoFilterItem[];
  marcas: DepositoFilterItem[];
  estilos: DepositoFilterItem[];
  tipo1: DepositoFilterItem[];
  tipoV2: DepositoFilterItem[];
  lineas: DepositoFilterItem[];
  tonos: string[];
  gradas: string[];
};

function uniqItems(
  rows: DepositoRow[],
  idKey: keyof DepositoRow,
  labelFn: (r: DepositoRow) => string,
): DepositoFilterItem[] {
  const map = new Map<number, DepositoFilterItem>();
  for (const r of rows) {
    const n = normFk(r[idKey]);
    if (n == null) continue;
    if (!map.has(n)) map.set(n, { id: n, label: labelFn(r) });
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "es"));
}

export function buildOperativaOpciones(
  rows: DepositoRow[],
  filtros: OperativaFilterState,
): OperativaOpciones {
  const base = (excluir: ExcluirDimension) => applyOperativaFilters(rows, filtros, excluir);

  const tonoRows = base("tonos");
  const tonos = Array.from(
    new Set(
      tonoRows
        .map((r) => tonoEfectivo(r))
        .filter((t): t is string => Boolean(t)),
    ),
  ).sort((a, b) => a.localeCompare(b, "es"));

  return {
    generos: uniqItems(base("generoIds"), "genero_id", (r) => r.genero),
    marcas: uniqItems(base("marcaIds"), "marca_id", (r) => r.marca),
    estilos: uniqItems(base("grupoEstiloIds"), "grupo_estilo_id", (r) => r.estilo),
    tipo1: uniqItems(base("tipo1Ids"), "tipo_1_id", (r) => r.tipo_1 ?? String(r.tipo_1_id)).filter(
      (x) => x.label !== "(sin tipo 1)",
    ),
    tipoV2: uniqItems(base("tipoV2Ids"), "tipo_v2_id", (r) => r.tipo_v2),
    lineas: uniqItems(base("lineaIds"), "linea_id", (r) => r.linea_codigo_proveedor),
    tonos,
    gradas: listGradasOperativa(base("gradas")),
  };
}
