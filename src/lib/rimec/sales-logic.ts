import {
  ALIAS_CURRENT_VALUE,
  ALIAS_TARGET_VALUE,
  ALIAS_VARIATION,
  MES_NOMBRES,
} from "@/modules/sales-report/constants";
import type { SalesReportFilters } from "@/modules/sales-report/types";
import { variacionPctVsObjetivo } from "./variacion-objetivo";

export type PivotRow = Record<string, unknown>;

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function calcVariacionPct(actual: number, objetivo: number): number | null {
  return variacionPctVsObjetivo(objetivo, actual);
}

function aggByKeys(
  rows: PivotRow[],
  groupKeys: string[],
  sumKeys: string[]
): PivotRow[] {
  const map = new Map<string, PivotRow>();
  for (const r of rows) {
    const key = groupKeys.map((k) => String(r[k] ?? "")).join("\u0001");
    let acc = map.get(key);
    if (!acc) {
      acc = {};
      for (const k of groupKeys) acc[k] = r[k];
      for (const s of sumKeys) acc[s] = 0;
      map.set(key, acc);
    }
    for (const s of sumKeys) {
      acc[s] = num(acc[s]) + num(r[s]);
    }
  }
  return Array.from(map.values());
}

function enrichVariacion(rows: PivotRow[]): PivotRow[] {
  const a = ALIAS_CURRENT_VALUE;
  const t = ALIAS_TARGET_VALUE;
  const v = ALIAS_VARIATION;
  return rows.map((r) => {
    const vari = calcVariacionPct(num(r[a]), num(r[t]));
    return { ...r, [v]: vari };
  });
}

export type RimecKpis = {
  montoActual: number;
  montoObjetivo: number;
  variacionGlobalPct: number | null;
  clientesUnicos: number;
  registros: number;
  /** % de clientes (agregados) con monto actual > 0 en el período filtrado. */
  atendimientoPct: number | null;
  /** Alias UI — clientes con compra en el período (conteo agregado). */
  totalClientes: number;
  /** Alias UI — igual que `variacionGlobalPct`. */
  variacionPct: number | null;
};

export type RimecEvolucionMes = {
  mes_idx: number;
  mes: string;
  montoActual: number;
  montoObjetivo: number;
  variacionPct: number | null;
};

export type RimecAnalysisPackage = {
  filtros: SalesReportFilters;
  kpis: RimecKpis;
  evolucionMes: RimecEvolucionMes[];
  cartera: {
    crecimiento: PivotRow[];
    riesgo: PivotRow[];
    sinCompra: PivotRow[];
  };
  porMarca: PivotRow[];
  porVendedor: PivotRow[];
  pivot: PivotRow[];
  /** Todos los clientes agregados (venta vs obj), orden por monto actual. */
  carteraCompleta: PivotRow[];
};

/**
 * Paridad funcional con modules/sales_report/logic.py — get_full_analysis_package.
 * Consume filas ya enriquecidas por enrichPivotRows (alias Monto 26 / Obj / Variación %).
 */
export function getFullAnalysisPackage(
  pivotRows: PivotRow[],
  filtros: SalesReportFilters
): RimecAnalysisPackage {
  const a = ALIAS_CURRENT_VALUE;
  const t = ALIAS_TARGET_VALUE;

  const montoActual = pivotRows.reduce((s, r) => s + num(r[a]), 0);
  const montoObjetivo = pivotRows.reduce((s, r) => s + num(r[t]), 0);
  const variacionGlobalPct = calcVariacionPct(montoActual, montoObjetivo);

  const clientesSet = new Set(
    pivotRows.map((r) => String(r.cliente ?? "").trim()).filter(Boolean)
  );

  const byMes = enrichVariacion(
    aggByKeys(pivotRows, ["mes_idx"], [a, t]).sort((x, y) => num(x.mes_idx) - num(y.mes_idx))
  );

  const evolucionMes: RimecEvolucionMes[] = byMes.map((r) => {
    const idx = Math.round(num(r.mes_idx));
    return {
      mes_idx: idx,
      mes: MES_NOMBRES[idx] ?? String(idx),
      montoActual: num(r[a]),
      montoObjetivo: num(r[t]),
      variacionPct: r[ALIAS_VARIATION] as number | null,
    };
  });

  const porCliente = enrichVariacion(aggByKeys(pivotRows, ["cliente"], [a, t]));

  const variNum = (r: PivotRow): number | null => {
    const v = r[ALIAS_VARIATION];
    if (v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const crecimiento = porCliente
    .filter((r) => {
      const v = variNum(r);
      return v !== null && v > 0;
    })
    .sort((x, y) => (variNum(y) ?? 0) - (variNum(x) ?? 0));

  const riesgo = porCliente
    .filter((r) => {
      const v = variNum(r);
      return v !== null && v < 0;
    })
    .sort((x, y) => (variNum(x) ?? 0) - (variNum(y) ?? 0));

  const sinCompra = porCliente
    .filter((r) => num(r[a]) === 0)
    .sort((x, y) => String(x.cliente).localeCompare(String(y.cliente)));

  const conCompra = porCliente.filter((r) => num(r[a]) > 0).length;
  const totCli = porCliente.length;
  const atendimientoPct =
    totCli > 0 ? Math.round((conCompra / totCli) * 1000) / 10 : null;

  const carteraCompleta = [...porCliente].sort((x, y) => num(y[a]) - num(x[a]));

  const porMarca = enrichVariacion(
    aggByKeys(pivotRows, ["marca"], [a, t]).sort((x, y) => num(y[a]) - num(x[a]))
  );

  const porVendedor = enrichVariacion(
    aggByKeys(pivotRows, ["vendedor"], [a, t]).sort((x, y) => num(y[a]) - num(x[a]))
  );

  return {
    filtros,
    kpis: {
      montoActual,
      montoObjetivo,
      variacionGlobalPct,
      clientesUnicos: clientesSet.size,
      registros: pivotRows.length,
      atendimientoPct,
      totalClientes: conCompra,
      variacionPct: variacionGlobalPct,
    },
    evolucionMes,
    cartera: { crecimiento, riesgo, sinCompra },
    porMarca,
    porVendedor,
    pivot: pivotRows,
    carteraCompleta,
  };
}

/** Demo sin BD — mismo pipeline con pivot vacío. */
export function getMockAnalysisPackage(filtros: SalesReportFilters): RimecAnalysisPackage {
  return getFullAnalysisPackage([], filtros);
}
