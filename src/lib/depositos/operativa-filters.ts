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

function effectiveOperativaFilters(
  f: OperativaFilterState,
  excluir?: ExcluirDimension,
): OperativaFilterState {
  return excluir ? { ...f, [excluir]: emptyForExcluir(excluir) } : f
}

/** Evalúa una fila sin pasadas intermedias — base de apply + buildOperativaOpciones. */
export function rowMatchesOperativaFilters(
  r: DepositoRow,
  f: OperativaFilterState,
  excluir?: ExcluirDimension,
  opts?: { incluirVendidoSinSaldo?: boolean },
): boolean {
  const eff = effectiveOperativaFilters(f, excluir)

  if (opts?.incluirVendidoSinSaldo) {
    if (r.cantidad <= 0 && (r.pares_vendidos ?? 0) <= 0) return false
  } else if (r.cantidad <= 0) {
    return false
  }

  if (eff.generoIds.length && !matchFk(r.genero_id, eff.generoIds)) return false
  if (eff.marcaIds.length && !matchFk(r.marca_id, eff.marcaIds)) return false
  if (eff.grupoEstiloIds.length && !matchFk(r.grupo_estilo_id, eff.grupoEstiloIds)) return false
  if (eff.tipo1Ids.length && !matchFk(r.tipo_1_id, eff.tipo1Ids)) return false
  if (eff.tipoV2Ids.length && !matchFk(r.tipo_v2_id, eff.tipoV2Ids)) return false
  if (eff.lineaIds.length && !matchFk(r.linea_id, eff.lineaIds)) return false
  if (eff.tipoGrupos.length && !rowMatchesTipoGrupos(r, eff.tipoGrupos)) return false

  if (eff.materialFamilias.length) {
    const want = new Set(eff.materialFamilias)
    const k = r.familia_material ?? primeraPalabraPilar(r.descp_material)
    if (!k || !want.has(k)) return false
  }
  if (eff.colorFamilias.length) {
    const want = new Set(eff.colorFamilias)
    const k = r.familia_color ?? primeraPalabraPilar(r.descp_color)
    if (!k || !want.has(k)) return false
  }

  if (eff.sinTono) {
    if (tonoEfectivo(r)) return false
  } else if (eff.tonos.length) {
    const te = tonoEfectivo(r)
    if (!te) return false
    const low = te.toLowerCase()
    const set = eff.tonos.map((t) => t.toLowerCase())
    if (!set.some((t) => low === t || low.includes(t))) return false
  }

  const q = eff.q.trim().toLowerCase()
  if (q) {
    const lineaRef = [r.linea_codigo_proveedor, r.referencia_codigo_proveedor]
      .map((v) => String(v ?? "").trim())
      .filter(Boolean)
      .join(".")
    const qMol = q.replace(/[\s.\-_]+/g, "")
    const lineaRefMol = lineaRef.replace(/[\s.\-_]+/g, "").toLowerCase()
    const hitMol = qMol.length >= 2 && lineaRefMol.includes(qMol)
    const hit = hitMol || [
      r.marca,
      r.linea_codigo_proveedor,
      r.referencia_codigo_proveedor,
      lineaRef,
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
    ].some((v) => v && String(v).toLowerCase().includes(q))
    if (!hit) return false
  }

  return true
}

export function applyOperativaFilters(
  rows: DepositoRow[],
  f: OperativaFilterState,
  excluir?: ExcluirDimension,
  opts?: { incluirVendidoSinSaldo?: boolean },
): DepositoRow[] {
  const eff = effectiveOperativaFilters(f, excluir)
  let out = rows.filter((r) => rowMatchesOperativaFilters(r, f, excluir, opts))

  if (eff.materialFamilias.length && out.some((r) => r.familia_material === undefined)) {
    const want = new Set(eff.materialFamilias)
    const matMap = buildFamiliaClusters(
      out.map((r) => primeraPalabraPilar(r.descp_material)).filter((t): t is string => Boolean(t)),
    )
    out = out.filter((r) => {
      const k = r.familia_material ?? familiaKeyFromDescripcion(r.descp_material, matMap)
      return k != null && want.has(k)
    })
  }
  if (eff.colorFamilias.length && out.some((r) => r.familia_color === undefined)) {
    const want = new Set(eff.colorFamilias)
    const colMap = buildFamiliaClusters(
      out.map((r) => primeraPalabraPilar(r.descp_color)).filter((t): t is string => Boolean(t)),
    )
    out = out.filter((r) => {
      const k = r.familia_color ?? familiaKeyFromDescripcion(r.descp_color, colMap)
      return k != null && want.has(k)
    })
  }

  if (!excluir) {
    return applyCantidadGradaFilter(out, eff)
  }
  return out
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
  opts?: { skipZero?: boolean; skipLabels?: (label: string) => boolean },
): DepositoFilterItem[] {
  const map = new Map<number, DepositoFilterItem>();
  for (const r of rows) {
    const n = normFk(r[idKey]);
    if (n == null) continue;
    if (opts?.skipZero && n === 0) continue;
    const label = labelFn(r).trim();
    if (!label) continue;
    if (opts?.skipLabels?.(label)) continue;
    if (!map.has(n)) map.set(n, { id: n, label });
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "es"));
}

/** Holding / placeholders — no son marca comercial. */
export function esMarcaFantasmaFiltro(label: string): boolean {
  const t = label.trim().toUpperCase();
  return (
    !t ||
    t === "RIMEC" ||
    t === "—" ||
    t === "-" ||
    t === "(SIN MARCA)" ||
    t === "SIN MARCA"
  );
}

export function buildOperativaOpciones(
  rows: DepositoRow[],
  filtros: OperativaFilterState,
): OperativaOpciones {
  const generos = new Map<number, DepositoFilterItem>()
  const marcas = new Map<number, DepositoFilterItem>()
  const estilos = new Map<number, DepositoFilterItem>()
  const tipo1 = new Map<number, DepositoFilterItem>()
  const tipoV2 = new Map<number, DepositoFilterItem>()
  const lineas = new Map<number, DepositoFilterItem>()
  const tonos = new Set<string>()
  const gradas = new Set<string>()
  const matTokens: string[] = []
  const colTokens: string[] = []

  for (const r of rows) {
    if (r.cantidad <= 0) continue

    if (rowMatchesOperativaFilters(r, filtros, 'generoIds')) {
      const n = normFk(r.genero_id)
      const label = String(r.genero ?? '').trim()
      if (n != null && label) generos.set(n, { id: n, label })
    }
    if (rowMatchesOperativaFilters(r, filtros, 'marcaIds')) {
      const n = normFk(r.marca_id)
      const label = String(r.marca ?? '').trim()
      if (n != null && n !== 0 && label && !esMarcaFantasmaFiltro(label)) {
        marcas.set(n, { id: n, label })
      }
    }
    if (rowMatchesOperativaFilters(r, filtros, 'grupoEstiloIds')) {
      const n = normFk(r.grupo_estilo_id)
      const label = String(r.estilo ?? '').trim()
      if (n != null && label) estilos.set(n, { id: n, label })
    }
    if (rowMatchesOperativaFilters(r, filtros, 'tipo1Ids')) {
      const n = normFk(r.tipo_1_id)
      const label = String(r.tipo_1 ?? r.tipo_1_id ?? '').trim()
      if (n != null && label && label !== '(sin tipo 1)') tipo1.set(n, { id: n, label })
    }
    if (rowMatchesOperativaFilters(r, filtros, 'tipoV2Ids')) {
      const n = normFk(r.tipo_v2_id)
      const label = String(r.tipo_v2 ?? '').trim()
      if (n != null && label) tipoV2.set(n, { id: n, label })
    }
    if (rowMatchesOperativaFilters(r, filtros, 'lineaIds')) {
      const n = normFk(r.linea_id)
      const label = String(r.linea_codigo_proveedor ?? '').trim()
      if (n != null && label) lineas.set(n, { id: n, label })
    }
    if (rowMatchesOperativaFilters(r, filtros, 'tonos')) {
      const te = tonoEfectivo(r)
      if (te) tonos.add(te)
    }
    if (rowMatchesOperativaFilters(r, filtros, 'materialFamilias')) {
      const t = r.familia_material ?? primeraPalabraPilar(r.descp_material)
      if (t) matTokens.push(t)
    }
    if (rowMatchesOperativaFilters(r, filtros, 'colorFamilias')) {
      const t = r.familia_color ?? primeraPalabraPilar(r.descp_color)
      if (t) colTokens.push(t)
    }
    if (rowMatchesOperativaFilters(r, filtros, 'gradas')) {
      const g = normalizeGradaLabel(r.grada)
      if (g) gradas.add(g)
    }
  }

  const sortItems = (m: Map<number, DepositoFilterItem>) =>
    Array.from(m.values()).sort((a, b) => a.label.localeCompare(b.label, 'es'))

  return {
    generos: sortItems(generos),
    marcas: sortItems(marcas),
    estilos: sortItems(estilos),
    tipo1: sortItems(tipo1),
    tipoV2: sortItems(tipoV2),
    lineas: sortItems(lineas),
    materiales: buildFamiliaItems(matTokens),
    colores: buildFamiliaItems(colTokens),
    tonos: Array.from(tonos).sort((a, b) => a.localeCompare(b, 'es')),
    gradas: Array.from(gradas).sort(sortGradaLabels),
  }
}
