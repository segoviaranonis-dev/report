/**
 * OT-INFORME-003 — arma el JSON del snapshot a partir del pivot enriquecido.
 * Paridad de reglas con `getFullAnalysisPackage` (logic.py / sales-logic.ts).
 */

import {
  ALIAS_CURRENT_VALUE,
  ALIAS_TARGET_VALUE,
  ALIAS_VARIATION,
  MESES_LISTA,
  MES_MAP,
  MES_NOMBRES,
} from "@/modules/sales-report/constants";
import type { SalesReportFilters } from "@/modules/sales-report/types";
import type {
  FullSnapshotCascada,
  FullSnapshotClienteSinCompra,
  FullSnapshotClienteTabla,
  FullSnapshotJerarquiaLeaf,
  FullSnapshotParticipacion,
  FullSnapshotRankingMarca,
  FullSnapshotRankingVendedor,
  FullSnapshotResponse,
} from "./full-snapshot-types";
import { getFullAnalysisPackage, type PivotRow } from "./sales-logic";
import { variacionPctVsObjetivo } from "./variacion-objetivo";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function aggByKeys(rows: PivotRow[], groupKeys: string[], sumKeys: string[]): PivotRow[] {
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
    const tgt = num(r[t]);
    const act = num(r[a]);
    return { ...r, [v]: variacionPctVsObjetivo(tgt, act) };
  });
}

function variacionYoy(m26: number, m25: number): number | null {
  if (m25 > 0) return ((m26 - m25) / m25) * 100;
  if (m26 > 0) return null;
  return 0;
}

function cumplimientoPct(m26: number, obj: number): number {
  if (obj <= 0) return m26 > 0 ? 100 : 0;
  return (m26 / obj) * 100;
}

/** Heurística documentada: participación calzado vs confección por texto de `tipo`. */
function participacionBucket(tipo: unknown): "calzado" | "confeccion" | null {
  const t = String(tipo ?? "").toUpperCase();
  if (t.includes("CALZAD")) return "calzado";
  if (t.includes("CONFEC") || t.includes("TEXTIL") || t.includes("VEST") || t.includes("MODA"))
    return "confeccion";
  return null;
}

function firstPivotRowForCliente(rows: PivotRow[], cliente: string): PivotRow | undefined {
  const target = cliente.trim();
  for (const r of rows) {
    if (String(r.cliente ?? "").trim() === target) return r;
  }
  return undefined;
}

function marcaPrincipal(rows: PivotRow[], cliente: string): string {
  let best = "S/I";
  let bestM = 0;
  const target = cliente.trim();
  for (const r of rows) {
    if (String(r.cliente ?? "").trim() !== target) continue;
    const m = num(r.monto_26);
    if (m > bestM) {
      bestM = m;
      best = String(r.marca ?? "S/I");
    }
  }
  return best;
}

function variNum(r: PivotRow): number | null {
  const v = r[ALIAS_VARIATION];
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatPeriodoLabel(f: SalesReportFilters): string {
  const ord = [...f.meses].sort((a, b) => (MES_MAP[a] ?? 0) - (MES_MAP[b] ?? 0));
  if (!ord.length) return "2026";
  if (ord.length === 1) return `${ord[0]} 2026`;
  return `${ord[0]}–${ord[ord.length - 1]} 2026`;
}

function packParticipacion(calzado: number, confeccion: number): FullSnapshotParticipacion["y2025"] {
  const denom = calzado + confeccion;
  const total = denom > 0 ? denom : 1;
  return {
    calzado: { monto: calzado, pct: (calzado / total) * 100 },
    confeccion: { monto: confeccion, pct: (confeccion / total) * 100 },
  };
}

/** Participación por rubro: 2025 = suma `monto_25`, 2026 = suma `monto_26` del período. */
function buildParticipacion(rows: PivotRow[]): FullSnapshotParticipacion {
  let c25 = 0;
  let f25 = 0;
  let c26 = 0;
  let f26 = 0;
  for (const r of rows) {
    const b = participacionBucket(r.tipo);
    if (b === "calzado") {
      c25 += num(r.monto_25);
      c26 += num(r.monto_26);
    } else if (b === "confeccion") {
      f25 += num(r.monto_25);
      f26 += num(r.monto_26);
    }
  }
  return {
    y2025: packParticipacion(c25, f25),
    y2026: packParticipacion(c26, f26),
  };
}

function mapClienteTabla(pivot: PivotRow[], list: PivotRow[]): FullSnapshotClienteTabla[] {
  const a = ALIAS_CURRENT_VALUE;
  const t = ALIAS_TARGET_VALUE;
  return list.map((r) => {
    const nombre = String(r.cliente ?? "").trim();
    const base = firstPivotRowForCliente(pivot, nombre);
    const m26 = num(r[a]);
    const m25 = num(r["monto_25"]);
    const obj = num(r[t]);
    const codigo = String(base?.codigo_cliente ?? base?.codigo ?? nombre).trim() || nombre;
    const idParsed = Number(base?.codigo_cliente);
    const id_cliente =
      Number.isFinite(idParsed) && idParsed > 0 ? Math.trunc(idParsed) : Number.parseInt(codigo, 10) || 0;
    return {
      id_cliente,
      codigo,
      nombre,
      cadena: String(base?.cadena ?? "").trim(),
      monto_2026: m26,
      monto_2025: m25,
      variacion_pct: variacionYoy(m26, m25),
      marca_principal: marcaPrincipal(pivot, nombre),
    };
  });
}

function pickUltimoMes(base: PivotRow | undefined): string {
  if (!base) return "—";
  const keys = ["ultimo_mes", "mes_ultima_compra", "ultima_compra_mes", "mes_ultimo", "ultimo_mes_compra"];
  for (const k of keys) {
    const v = base[k];
    if (v !== null && v !== undefined && String(v).trim() !== "") return String(v).trim();
  }
  return "—";
}

function mapSinCompra(pivot: PivotRow[], list: PivotRow[]): FullSnapshotClienteSinCompra[] {
  return list.map((r) => {
    const nombre = String(r.cliente ?? "").trim();
    const base = firstPivotRowForCliente(pivot, nombre);
    const codigo = String(base?.codigo_cliente ?? base?.codigo ?? nombre).trim() || nombre;
    const idParsed = Number(base?.codigo_cliente);
    const id_cliente =
      Number.isFinite(idParsed) && idParsed > 0 ? Math.trunc(idParsed) : Number.parseInt(codigo, 10) || 0;
    return {
      id_cliente,
      codigo,
      nombre,
      cadena: String(base?.cadena ?? "").trim(),
      ultimo_monto: num(base?.monto_25),
      ultimo_mes: pickUltimoMes(base),
    };
  });
}

export function buildFullSnapshotResponse(
  enrichedPivot: PivotRow[],
  filtros: SalesReportFilters,
  jerarquia_clientes: FullSnapshotJerarquiaLeaf[] = []
): FullSnapshotResponse {
  const pkg = getFullAnalysisPackage(enrichedPivot, filtros);
  const a = ALIAS_CURRENT_VALUE;
  const t = ALIAS_TARGET_VALUE;

  const monto_periodo_anterior = enrichedPivot.reduce((s, r) => s + num(r.monto_25), 0);
  const variacionInteranual =
    monto_periodo_anterior > 0
      ? ((pkg.kpis.montoActual - monto_periodo_anterior) / monto_periodo_anterior) * 100
      : pkg.kpis.variacionGlobalPct;

  const porClienteFull = enrichVariacion(aggByKeys(enrichedPivot, ["cliente"], [a, t, "monto_25"]));

  const crecimiento = porClienteFull
    .filter((r) => {
      const v = variNum(r);
      return v !== null && v > 0;
    })
    .sort((x, y) => (variNum(y) ?? 0) - (variNum(x) ?? 0));

  const riesgo = porClienteFull
    .filter((r) => {
      const v = variNum(r);
      return v !== null && v < 0;
    })
    .sort((x, y) => (variNum(x) ?? 0) - (variNum(y) ?? 0));

  const sinCompra = porClienteFull
    .filter((r) => num(r[a]) === 0)
    .sort((x, y) => String(x.cliente).localeCompare(String(y.cliente)));

  const clientes_activos = porClienteFull.filter((r) => num(r[a]) > 0).length;

  const m25ByMes = new Map<number, number>();
  for (const r of aggByKeys(enrichedPivot, ["mes_idx"], ["monto_25"])) {
    m25ByMes.set(Math.round(num(r.mes_idx)), num(r["monto_25"]));
  }

  const evolucion_mensual = pkg.evolucionMes.map((e) => {
    const real_2025 = m25ByMes.get(e.mes_idx) ?? 0;
    const real_2026 = e.montoActual;
    const objetivo = e.montoObjetivo;
    const desvio_pct = (() => {
      const v = variacionPctVsObjetivo(objetivo, real_2026);
      if (v !== null && Number.isFinite(v)) return v;
      return real_2026 > 0 ? 100 : 0;
    })();
    return {
      mes: e.mes,
      real_2026,
      objetivo,
      real_2025,
      desvio_pct: Number.isFinite(desvio_pct) ? desvio_pct : 0,
    };
  });

  const participacion = buildParticipacion(enrichedPivot);

  const porMarcaFull = enrichVariacion(
    aggByKeys(enrichedPivot, ["marca"], [a, t, "monto_25"]).sort((x, y) => num(y[a]) - num(x[a]))
  );

  const ranking_marcas: FullSnapshotRankingMarca[] = porMarcaFull.map((r) => {
    const m26 = num(r[a]);
    const m25 = num(r["monto_25"]);
    const obj = num(r[t]);
    return {
      marca: String(r.marca ?? "S/I"),
      monto_2026: m26,
      monto_2025: m25,
      objetivo: obj,
      variacion_pct: variacionYoy(m26, m25),
      cumplimiento_pct: cumplimientoPct(m26, obj),
    };
  });

  const porVendFull = enrichVariacion(
    aggByKeys(enrichedPivot, ["vendedor"], [a, t, "monto_25"]).sort((x, y) => num(y[a]) - num(x[a]))
  );

  const activeByVend = new Map<string, Set<string>>();
  for (const r of enrichedPivot) {
    const v = String(r.vendedor ?? "").trim();
    const c = String(r.cliente ?? "").trim();
    if (!v || !c || num(r[a]) <= 0) continue;
    if (!activeByVend.has(v)) activeByVend.set(v, new Set());
    activeByVend.get(v)!.add(c);
  }

  const ranking_vendedores: FullSnapshotRankingVendedor[] = porVendFull.map((r) => {
    const vkey = String(r.vendedor ?? "").trim();
    const m26 = num(r[a]);
    const m25 = num(r["monto_25"]);
    const obj = num(r[t]);
    return {
      vendedor: vkey || "S/I",
      monto_2026: m26,
      monto_2025: m25,
      objetivo: obj,
      variacion_pct: variacionYoy(m26, m25),
      cumplimiento_pct: cumplimientoPct(m26, obj),
      clientes_activos: activeByVend.get(vkey)?.size ?? 0,
    };
  });

  const detalle_operativo: Record<string, unknown>[] = enrichedPivot.map((r) => {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      if (v instanceof Date) o[k] = v.toISOString();
      else o[k] = v as unknown;
    }
    return o;
  });

  const cascada: FullSnapshotCascada = {
    departamentos: filtros.departamento ? [filtros.departamento] : [],
    categorias: [],
    meses_nombres: [...MESES_LISTA],
    marcas: Array.from(new Set(enrichedPivot.map(r => String(r.marca ?? "")).filter(Boolean))),
    cadenas: Array.from(new Set(enrichedPivot.map(r => String(r.cadena ?? "")).filter(Boolean))),
    vendedores: Array.from(new Set(enrichedPivot.map(r => String(r.vendedor ?? "")).filter(Boolean))),
  };

  return {
    configured: true,
    kpis: {
      monto_periodo: pkg.kpis.montoActual,
      monto_objetivo: pkg.kpis.montoObjetivo,
      variacion_pct: variacionInteranual,
      clientes_activos,
      monto_periodo_anterior,
    },
    evolucion_mensual,
    participacion,
    clientes_crecimiento: mapClienteTabla(enrichedPivot, crecimiento),
    clientes_riesgo: mapClienteTabla(enrichedPivot, riesgo),
    clientes_sin_compra: mapSinCompra(enrichedPivot, sinCompra),
    ranking_marcas,
    ranking_vendedores,
    detalle_operativo,
    jerarquia_clientes,
    meta: {
      periodo: formatPeriodoLabel(filtros),
      objetivo_pct: filtros.objetivo_pct,
      departamento: filtros.departamento,
      generado_at: new Date().toISOString(),
    },
    cascada,
  };
}

export function getMockFullSnapshot(filtros: SalesReportFilters): FullSnapshotResponse {
  const demoCascada: FullSnapshotCascada = {
    departamentos: ["TODOS", "CALZADOS", "CONFECCIONES"],
    categorias: [{ id_categoria: 3, nombre: "PROGRAMADO" }],
    meses_nombres: [...MESES_LISTA],
    marcas: [],
    cadenas: [],
    vendedores: [],
  };
  return { ...buildFullSnapshotResponse([], filtros), cascada: demoCascada };
}
