/**
 * Adapta la respuesta de POST /api/rimec/full-snapshot al shape `RimecAnalysisPackage`
 * que consume la UI (tablas 1–8) sin recalcular agregados.
 */

import {
  ALIAS_CURRENT_VALUE,
  ALIAS_TARGET_VALUE,
  ALIAS_VARIATION,
  MES_MAP,
} from "@/modules/sales-report/constants";
import type { SalesReportFilters } from "@/modules/sales-report/types";
import type {
  FullSnapshotClienteSinCompra,
  FullSnapshotClienteTabla,
  FullSnapshotRankingMarca,
  FullSnapshotRankingVendedor,
  FullSnapshotResponse,
} from "./full-snapshot-types";
import type { PivotRow, RimecAnalysisPackage, RimecEvolucionMes, RimecKpis } from "./sales-logic";
import { variacionPctVsObjetivo } from "./variacion-objetivo";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function aggByCliente(rows: PivotRow[]): Map<string, { act: number; obj: number }> {
  const a = ALIAS_CURRENT_VALUE;
  const t = ALIAS_TARGET_VALUE;
  const m = new Map<string, { act: number; obj: number }>();
  for (const r of rows) {
    const c = String(r.cliente ?? "").trim();
    if (!c) continue;
    const cur = m.get(c) ?? { act: 0, obj: 0 };
    cur.act += num(r[a]);
    cur.obj += num(r[t]);
    m.set(c, cur);
  }
  return m;
}

function atendimientoFromPivot(rows: PivotRow[]): number | null {
  const m = aggByCliente(rows);
  if (!m.size) return null;
  let con = 0;
  for (const { act } of m.values()) {
    if (act > 0) con += 1;
  }
  return Math.round((con / m.size) * 1000) / 10;
}

function carteraCompletaFromPivot(pivot: PivotRow[]): PivotRow[] {
  const a = ALIAS_CURRENT_VALUE;
  const t = ALIAS_TARGET_VALUE;
  const m = aggByCliente(pivot);
  const out: PivotRow[] = [];
  for (const [cliente, { act, obj }] of m) {
    const vari = variacionPctVsObjetivo(obj, act);
    out.push({
      cliente,
      [a]: act,
      [t]: obj,
      [ALIAS_VARIATION]: vari,
    });
  }
  out.sort((x, y) => num(y[a]) - num(x[a]));
  return out;
}

function mapClienteTablaToPivot(
  rows: FullSnapshotClienteTabla[],
  filtros: SalesReportFilters
): PivotRow[] {
  const mult = 1 + filtros.objetivo_pct / 100;
  return rows.map((r) => {
    const montoObj = r.monto_2025 * mult;
    return {
      cliente: r.nombre,
      codigo_cliente: r.id_cliente > 0 ? String(r.id_cliente) : r.codigo,
      cadena: r.cadena,
      marca: r.marca_principal,
      [ALIAS_CURRENT_VALUE]: r.monto_2026,
      [ALIAS_TARGET_VALUE]: montoObj,
      [ALIAS_VARIATION]: variacionPctVsObjetivo(montoObj, r.monto_2026),
    };
  });
}

function mapSinCompraToPivot(
  rows: FullSnapshotClienteSinCompra[],
  filtros: SalesReportFilters
): PivotRow[] {
  const mult = 1 + filtros.objetivo_pct / 100;
  return rows.map((r) => {
    const base = num(r.ultimo_monto);
    const montoObj = base * mult;
    return {
      cliente: r.nombre,
      codigo_cliente: r.id_cliente > 0 ? String(r.id_cliente) : r.codigo,
      cadena: r.cadena,
      [ALIAS_CURRENT_VALUE]: 0,
      [ALIAS_TARGET_VALUE]: montoObj,
      [ALIAS_VARIATION]: variacionPctVsObjetivo(montoObj, 0),
      ultimo_mes: r.ultimo_mes,
    };
  });
}

function mapRankingMarca(rows: FullSnapshotRankingMarca[]): PivotRow[] {
  return rows.map((r) => ({
    marca: r.marca,
    [ALIAS_CURRENT_VALUE]: r.monto_2026,
    [ALIAS_TARGET_VALUE]: r.objetivo,
    [ALIAS_VARIATION]: variacionPctVsObjetivo(r.objetivo, r.monto_2026),
  }));
}

function mapRankingVendedor(rows: FullSnapshotRankingVendedor[]): PivotRow[] {
  return rows.map((r) => ({
    vendedor: r.vendedor,
    [ALIAS_CURRENT_VALUE]: r.monto_2026,
    [ALIAS_TARGET_VALUE]: r.objetivo,
    [ALIAS_VARIATION]: variacionPctVsObjetivo(r.objetivo, r.monto_2026),
    clientes_activos: r.clientes_activos,
  }));
}

function mapEvolucion(snapshot: FullSnapshotResponse["evolucion_mensual"]): RimecEvolucionMes[] {
  return snapshot.map((e) => {
    const mes_idx = MES_MAP[e.mes] ?? 0;
    return {
      mes_idx,
      mes: e.mes,
      montoActual: e.real_2026,
      montoObjetivo: e.objetivo,
      variacionPct: (() => {
        const v = variacionPctVsObjetivo(e.objetivo, e.real_2026);
        if (v !== null && Number.isFinite(v)) return v;
        return e.real_2026 > 0 ? 100 : 0;
      })(),
    };
  });
}

export function isFullSnapshotApiPayload(j: Record<string, unknown>): boolean {
  const k = j.kpis;
  const c = j.cascada;
  return (
    j.configured === true &&
    typeof k === "object" &&
    k !== null &&
    "monto_periodo" in k &&
    Array.isArray(j.evolucion_mensual) &&
    Array.isArray(j.detalle_operativo) &&
    (!("jerarquia_clientes" in j) || Array.isArray(j.jerarquia_clientes)) &&
    typeof c === "object" &&
    c !== null &&
    Array.isArray((c as { departamentos?: unknown }).departamentos)
  );
}

export type SnapshotApiExtras = {
  _debug?: { sql?: string; paramCount?: number; pivot_rows?: number; filtros?: SalesReportFilters };
};

export function snapshotApiToPkgState(
  raw: Record<string, unknown>,
  filtros: SalesReportFilters
): RimecAnalysisPackage & { _debug?: SnapshotApiExtras["_debug"] } {
  const s = raw as FullSnapshotResponse & SnapshotApiExtras;
  const pivot = (s.detalle_operativo ?? []) as PivotRow[];

  const montoActual = s.kpis.monto_periodo;
  const montoObjetivo = s.kpis.monto_objetivo;
  const variacionGlobalPct = variacionPctVsObjetivo(montoObjetivo, montoActual);

  const kpis: RimecKpis = {
    montoActual,
    montoObjetivo,
    variacionGlobalPct,
    clientesUnicos: aggByCliente(pivot).size,
    registros: pivot.length,
    atendimientoPct: atendimientoFromPivot(pivot),
    totalClientes: s.kpis.clientes_activos,
    variacionPct: variacionGlobalPct,
  };

  const base: RimecAnalysisPackage = {
    filtros,
    kpis,
    evolucionMes: mapEvolucion(s.evolucion_mensual),
    cartera: {
      crecimiento: mapClienteTablaToPivot(s.clientes_crecimiento, filtros),
      riesgo: mapClienteTablaToPivot(s.clientes_riesgo, filtros),
      sinCompra: mapSinCompraToPivot(s.clientes_sin_compra, filtros),
    },
    porMarca: mapRankingMarca(s.ranking_marcas),
    porVendedor: mapRankingVendedor(s.ranking_vendedores),
    pivot,
    carteraCompleta: carteraCompletaFromPivot(pivot),
  };

  const dbg = raw._debug as SnapshotApiExtras["_debug"] | undefined;
  return dbg ? { ...base, _debug: dbg } : base;
}

/** Body compatible con `/api/rimec/full-snapshot` a partir de filtros UI. */
export function filtrosToFullSnapshotBody(f: SalesReportFilters): Record<string, unknown> {
  return {
    objetivo_pct: f.objetivo_pct,
    departamento: f.departamento,
    meses: f.meses,
    categoria_ids: f.categoria_ids,
    marcas: f.marcas,
    cadenas: f.cadenas,
    vendedores: f.vendedores,
    clientes: f.clientes,
    cliente_codigo: f.id_cliente_exacto,
  };
}
