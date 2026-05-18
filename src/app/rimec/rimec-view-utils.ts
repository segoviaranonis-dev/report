import {
  ALIAS_CURRENT_VALUE,
  ALIAS_TARGET_VALUE,
  ALIAS_VARIATION,
  MES_MAP,
} from "@/modules/sales-report/constants";
import type { RimecEvolucionMes } from "@/lib/rimec/sales-logic";
import { variacionPctVsObjetivo } from "@/lib/rimec/variacion-objetivo";
import type { SalesReportFilters } from "@/modules/sales-report/types";

export type PivotRow = Record<string, unknown>;

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function pickSubdimKey(pivot: PivotRow[]): string | null {
  if (!pivot.length) return null;
  const row = pivot[0];
  const candidates = ["cadena", "origen_tienda", "sucursal", "local", "punto_venta"] as const;
  for (const k of candidates) {
    if (k in row && row[k] != null && String(row[k]).trim() !== "") return k;
  }
  return null;
}

export function subrowsByCliente(
  pivot: PivotRow[],
  clienteNames: string[],
  maxPerCliente: number
): Map<string, PivotRow[]> {
  const subKey = pickSubdimKey(pivot);
  const out = new Map<string, PivotRow[]>();
  if (!subKey) return out;
  const a = ALIAS_CURRENT_VALUE;
  const t = ALIAS_TARGET_VALUE;
  const want = new Set(clienteNames.map((s) => s.trim()).filter(Boolean));
  const map = new Map<string, PivotRow>();
  for (const r of pivot) {
    const c = String(r.cliente ?? "").trim();
    if (!want.has(c)) continue;
    const sub = String(r[subKey] ?? "—").trim() || "—";
    const k = `${c}\u0001${sub}`;
    let acc = map.get(k);
    if (!acc) {
      acc = { cliente: c, [subKey]: sub, [a]: 0, [t]: 0 };
      map.set(k, acc);
    }
    acc[a] = num(acc[a]) + num(r[a]);
    acc[t] = num(acc[t]) + num(r[t]);
  }
  const enriched = Array.from(map.values()).map((r) => {
    return { ...r, [ALIAS_VARIATION]: variacionPctVsObjetivo(num(r[t]), num(r[a])) };
  });
  for (const r of enriched) {
    const c = String((r as any).cliente);
    if (!out.has(c)) out.set(c, []);
    out.get(c)!.push(r);
  }
  for (const [, arr] of out) {
    arr.sort((x, y) => num(y[a]) - num(x[a]));
    if (arr.length > maxPerCliente) arr.length = maxPerCliente;
  }
  return out;
}

export function mesesSemestre(which: "s1" | "s2" | "year"): string[] {
  if (which === "s1") return ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio"];
  if (which === "s2") return ["Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  return Object.keys(MES_MAP);
}

export function evolucionPorSemestre(
  evolucionMes: RimecEvolucionMes[],
  filtros: SalesReportFilters
): {
  label: string;
  key: string;
  rows: RimecEvolucionMes[];
  totObj: number;
  totAct: number;
  varPct: number | null;
}[] {
  const selected = new Set(
    filtros.meses.map((m) => MES_MAP[m]).filter((n): n is number => typeof n === "number")
  );
  const filtered = evolucionMes.filter((r) => selected.has(r.mes_idx));
  const s1 = filtered.filter((r) => r.mes_idx >= 1 && r.mes_idx <= 6);
  const s2 = filtered.filter((r) => r.mes_idx >= 7 && r.mes_idx <= 12);
  const pack = (
    label: string,
    key: string,
    rows: RimecEvolucionMes[]
  ): {
    label: string;
    key: string;
    rows: RimecEvolucionMes[];
    totObj: number;
    totAct: number;
    varPct: number | null;
  } => {
    const totObj = rows.reduce((s, x) => s + x.montoObjetivo, 0);
    const totAct = rows.reduce((s, x) => s + x.montoActual, 0);
    const varPct = totObj > 0 ? ((totAct - totObj) / totObj) * 100 : null;
    return { label, key, rows, totObj, totAct, varPct };
  };
  const groups: {
    label: string;
    key: string;
    rows: RimecEvolucionMes[];
    totObj: number;
    totAct: number;
    varPct: number | null;
  }[] = [];
  if (s1.length) groups.push(pack(`1er SEMESTRE (${s1.length})`, "s1", s1));
  if (s2.length) groups.push(pack(`2do SEMESTRE (${s2.length})`, "s2", s2));
  if (!groups.length && filtered.length) {
    groups.push(
      pack(
        `PERÍODO (${filtered.length})`,
        "all",
        [...filtered].sort((a, b) => a.mes_idx - b.mes_idx)
      )
    );
  }
  return groups;
}

export function fmtGs(n: number): string {
  return new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(Math.round(n));
}
