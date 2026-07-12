import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import type { OperativaFilterState } from "@/lib/depositos/operativa-filters";
import { buildOperativaOpciones } from "@/lib/depositos/operativa-filters";
import {
  applyStockTransitoFilters,
  buildStockTransitoOpciones,
  countTransitoCards,
  filterByQuincenas,
} from "@/lib/stock-transito/stock-transito-filters";

export { countTransitoCards as countProgramadoCards, filterByQuincenas };

/** Programado — incluye moléculas 100% vendidas (saldo=0 · vendido>0) como PP-8051. */
const PROGRAMADO_VENTAS_OPTS = { incluirVendidoSinSaldo: true as const };

export function filterByPpIds(rows: DepositoRow[], ppIds: string[]): DepositoRow[] {
  if (!ppIds.length) return rows;
  const set = new Set(ppIds);
  return rows.filter((r) => set.has(String(r.pp_id ?? 0)));
}

/** Normaliza token proforma: "8051" → coincide con "8051/2026". */
export function proformaMatchesToken(proforma: string | null | undefined, token: string): boolean {
  const p = String(proforma ?? "").trim().toLowerCase();
  const t = token.trim().toLowerCase();
  if (!p || !t) return false;
  if (p.includes(t)) return true;
  const pBase = p.split("/")[0]?.trim();
  return pBase === t || pBase.includes(t);
}

export function filterByProformaToken(rows: DepositoRow[], token: string): DepositoRow[] {
  const t = token.trim();
  if (!t) return rows;
  return rows.filter((r) => proformaMatchesToken(r.proforma, t));
}

export function applyStockProgramadoFilters(
  rows: DepositoRow[],
  filtros: OperativaFilterState,
  quincenaIds: string[],
  ppIds: string[] = [],
): DepositoRow[] {
  let scoped = filterByQuincenas(rows, quincenaIds);
  scoped = filterByPpIds(scoped, ppIds);
  if (ppIds.length === 0 && filtros.q.trim()) {
    scoped = filterByProformaToken(scoped, filtros.q.trim());
  }
  return applyStockTransitoFilters(scoped, filtros, [], PROGRAMADO_VENTAS_OPTS);
}

export function buildStockProgramadoOpciones(
  rows: DepositoRow[],
  filtros: OperativaFilterState,
  quincenaIds: string[],
  ppIds: string[] = [],
) {
  let scoped = filterByQuincenas(rows, quincenaIds);
  scoped = filterByPpIds(scoped, ppIds);
  if (ppIds.length === 0 && filtros.q.trim()) {
    scoped = filterByProformaToken(scoped, filtros.q.trim());
  }
  const baseRows = scoped.filter((r) => r.cantidad > 0 || (r.pares_vendidos ?? 0) > 0);
  const sinGrada = { ...filtros, gradas: [] };
  return { ...buildOperativaOpciones(baseRows, sinGrada), gradas: [] };
}
