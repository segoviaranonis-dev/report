import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import type { DepositoFilterItem } from "@/app/api/depositos/[cliente_id]/filtros/route";
import {
  matchesGradaSelection,
  normalizeGradaLabel,
  sortGradaLabels,
} from "@/lib/depositos/grada-operativa";
import { colorPredominante } from "@/lib/pilares/color-canon";
import { primeraPalabraPilar } from "@/lib/pilares/primera-palabra-pilar";
import {
  buildFamiliaClusters,
  buildFamiliaItems,
  familiaKeyFromDescripcion,
  type FamiliaPilarItem,
} from "@/lib/pilares/agrupar-etiqueta-pilar";

/**
 * Sella familia_material / familia_color una sola vez (evita Union-Find en cada filtro).
 * Numéricos → NN · textos → clave familia.
 */
export function stampFamiliaPilares(rows: DepositoRow[]): DepositoRow[] {
  if (!rows.length) return rows;
  const matTokens = rows
    .map((r) => primeraPalabraPilar(r.descp_material))
    .filter((t): t is string => Boolean(t));
  const colTokens = rows
    .map((r) => primeraPalabraPilar(r.descp_color))
    .filter((t): t is string => Boolean(t));
  const matMap = buildFamiliaClusters(matTokens);
  const colMap = buildFamiliaClusters(colTokens);
  return rows.map((r) => ({
    ...r,
    familia_material: familiaKeyFromDescripcion(r.descp_material, matMap),
    familia_color: familiaKeyFromDescripcion(r.descp_color, colMap),
  }));
}
import { normalizePrecioUnitario } from "@/lib/depositos/precio-venta";
import {
  rowMatchesTipoGrupos,
  type TipoGrupoId,
} from "@/lib/filtros/filtro-tipo-canonico";

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
  /** Alejandro Magno · SDRM cadena comercial (LIQUIDACION|REGULAR|null=todos) */
  cadenaComercial: string | null;
  /** Grupos canónicos Tipo (vacío = Todos). */
  tipoGrupos: TipoGrupoId[];
  /**
   * Familias Material / Color (claves de agrupar-etiqueta-pilar).
   * Una opción = muchas variantes (Napa·Nap·Np → Napa).
   */
  materialFamilias: string[];
  colorFamilias: string[];
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
  cadenaComercial: null,
  tipoGrupos: [],
  materialFamilias: [],
  colorFamilias: [],
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
    precio_unitario: normalizePrecioUnitario(r.precio_unitario),
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
    (f.cantidadOp != null && f.cantidadValor != null) ||
    !!f.cadenaComercial ||
    f.tipoGrupos.length > 0 ||
    f.materialFamilias.length > 0 ||
    f.colorFamilias.length > 0
  );
}

function moleculeKeyOperativa(p: DepositoRow): string {
  return `${p.linea_codigo_proveedor}-${p.referencia_codigo_proveedor}-${p.material_code}-${p.color_code}`;
}

/** Filtra moléculas por pares totales o por gradas elegidas (filas + card). */
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
    const itemsGrada = hasGradas
      ? items.filter((item) => matchesGradaSelection(f.gradas, item.grada))
      : items;

    if (hasGradas && itemsGrada.length === 0) continue;

    const paresTotal = (hasGradas ? itemsGrada : items).reduce((s, i) => s + i.cantidad, 0);

    if (hasCantidad && f.cantidadValor != null && f.cantidadOp) {
      if (f.cantidadOp === "gt" && !(paresTotal > f.cantidadValor)) continue;
      if (f.cantidadOp === "lt" && !(paresTotal < f.cantidadValor)) continue;
    }

    kept.add(key);
  }

  return rows.filter((r) => {
    const key = moleculeKeyOperativa(r);
    if (!kept.has(key)) return false;
    if (hasGradas) return matchesGradaSelection(f.gradas, r.grada);
    return true;
  });
}

export function listGradasOperativa(rows: DepositoRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    const g = normalizeGradaLabel(r.grada);
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
  opts?: { incluirVendidoSinSaldo?: boolean },
): DepositoRow[] {
  const eff: OperativaFilterState = excluir
    ? { ...f, [excluir]: emptyForExcluir(excluir) }
    : f;

  let out = opts?.incluirVendidoSinSaldo
    ? rows.filter((r) => r.cantidad > 0 || (r.pares_vendidos ?? 0) > 0)
    : rows.filter((r) => r.cantidad > 0);

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
  if (eff.tipoGrupos.length) {
    out = out.filter((r) => rowMatchesTipoGrupos(r, eff.tipoGrupos));
  }
  if (eff.materialFamilias.length) {
    const want = new Set(eff.materialFamilias);
    const needStamp = out.some((r) => r.familia_material === undefined);
    const matMap = needStamp
      ? buildFamiliaClusters(
          out
            .map((r) => primeraPalabraPilar(r.descp_material))
            .filter((t): t is string => Boolean(t)),
        )
      : null;
    out = out.filter((r) => {
      const k =
        r.familia_material ??
        (matMap ? familiaKeyFromDescripcion(r.descp_material, matMap) : null);
      return k != null && want.has(k);
    });
  }
  if (eff.colorFamilias.length) {
    const want = new Set(eff.colorFamilias);
    const needStamp = out.some((r) => r.familia_color === undefined);
    const colMap = needStamp
      ? buildFamiliaClusters(
          out
            .map((r) => primeraPalabraPilar(r.descp_color))
            .filter((t): t is string => Boolean(t)),
        )
      : null;
    out = out.filter((r) => {
      const k =
        r.familia_color ??
        (colMap ? familiaKeyFromDescripcion(r.descp_color, colMap) : null);
      return k != null && want.has(k);
    });
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
        r.proforma,
        r.pp_nro,
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
  /** Familias agrupadas · etiqueta canónica (sin códigos) */
  materiales: FamiliaPilarItem[];
  colores: FamiliaPilarItem[];
  tonos: string[];
  gradas: string[];
};

function uniqItems(
  rows: DepositoRow[],
  idKey: keyof DepositoRow,
  labelFn: (r: DepositoRow) => string,
  opts?: { skipZero?: boolean },
): DepositoFilterItem[] {
  const map = new Map<number, DepositoFilterItem>();
  for (const r of rows) {
    const n = normFk(r[idKey]);
    if (n == null) continue;
    if (opts?.skipZero && n === 0) continue;
    const label = labelFn(r).trim();
    if (!label) continue;
    if (!map.has(n)) map.set(n, { id: n, label });
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

  const matRows = base("materialFamilias");
  const colRows = base("colorFamilias");

  /** Preferir claves ya selladas; si no, tokens desde descripción. */
  const matTokens = matRows
    .map((r) => r.familia_material ?? primeraPalabraPilar(r.descp_material))
    .filter((t): t is string => Boolean(t));
  const colTokens = colRows
    .map((r) => r.familia_color ?? primeraPalabraPilar(r.descp_color))
    .filter((t): t is string => Boolean(t));

  return {
    generos: uniqItems(base("generoIds"), "genero_id", (r) => r.genero),
    marcas: uniqItems(base("marcaIds"), "marca_id", (r) => r.marca),
    estilos: uniqItems(base("grupoEstiloIds"), "grupo_estilo_id", (r) => r.estilo),
    tipo1: uniqItems(base("tipo1Ids"), "tipo_1_id", (r) => r.tipo_1 ?? String(r.tipo_1_id)).filter(
      (x) => x.label !== "(sin tipo 1)",
    ),
    tipoV2: uniqItems(base("tipoV2Ids"), "tipo_v2_id", (r) => r.tipo_v2),
    lineas: uniqItems(base("lineaIds"), "linea_id", (r) => r.linea_codigo_proveedor),
    materiales: buildFamiliaItems(matTokens),
    colores: buildFamiliaItems(colTokens),
    tonos,
    gradas: listGradasOperativa(base("gradas")),
  };
}
