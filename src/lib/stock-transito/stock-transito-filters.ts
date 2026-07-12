import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import {
  applyOperativaFilters,
  buildOperativaOpciones,
  type OperativaFilterState,
  type OperativaOpciones,
} from "@/lib/depositos/operativa-filters";

export function filterByQuincenas(rows: DepositoRow[], quincenaIds: string[]): DepositoRow[] {
  if (!quincenaIds.length) return rows;
  const set = new Set(quincenaIds);
  return rows.filter((r) => set.has(String(r.quincena_arribo_id ?? 0)));
}

/** @deprecated usar filterByQuincenas */
export function filterByQuincena(rows: DepositoRow[], quincenaId: string): DepositoRow[] {
  return filterByQuincenas(rows, quincenaId ? [quincenaId] : []);
}

export function buildStockTransitoOpciones(
  rows: DepositoRow[],
  filtros: OperativaFilterState,
  quincenaIds: string[],
): OperativaOpciones {
  const baseRows = filterByQuincenas(rows, quincenaIds);
  const sinGrada = { ...filtros, gradas: [] };
  return { ...buildOperativaOpciones(baseRows, sinGrada), gradas: [] };
}

export function applyStockTransitoFilters(
  rows: DepositoRow[],
  filtros: OperativaFilterState,
  quincenaIds: string[],
  operativaOpts?: { incluirVendidoSinSaldo?: boolean },
): DepositoRow[] {
  let out = filterByQuincenas(rows, quincenaIds);
  const peel: OperativaFilterState = {
    ...filtros,
    gradas: [],
    cantidadOp: null,
    cantidadValor: null,
  };
  out = applyOperativaFilters(out, peel, undefined, operativaOpts);
  if (filtros.cantidadOp != null && filtros.cantidadValor != null) {
    out = applyOperativaFilters(
      out,
      {
        ...peel,
        cantidadOp: filtros.cantidadOp,
        cantidadValor: filtros.cantidadValor,
      },
      undefined,
      operativaOpts,
    );
  }
  return out;
}

export function countTransitoCards(rows: DepositoRow[]): number {
  const keys = new Set(
    rows.map(
      (p) =>
        `${p.pp_id}-${p.linea_codigo_proveedor}-${p.referencia_codigo_proveedor}-${p.material_code}-${p.color_code}-${p.grada}`,
    ),
  );
  return keys.size;
}
