import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import {
  applyOperativaFilters,
  buildOperativaOpciones,
  type OperativaFilterState,
  type OperativaOpciones,
} from "@/lib/depositos/operativa-filters";

export function filterByDepositoLegal(rows: DepositoRow[], columnaLegal: string): DepositoRow[] {
  if (!columnaLegal) return rows;
  return rows.filter((r) => r.columna_stock_legal === columnaLegal);
}

export function buildStockPeOpciones(
  rows: DepositoRow[],
  filtros: OperativaFilterState,
  depositoLegal: string,
): OperativaOpciones {
  const baseRows = filterByDepositoLegal(rows, depositoLegal);
  const sinGrada = { ...filtros, gradas: [] };
  const opciones = buildOperativaOpciones(baseRows, sinGrada);
  return { ...opciones, gradas: [] };
}

export function applyStockPeFilters(
  rows: DepositoRow[],
  filtros: OperativaFilterState,
  depositoLegal: string,
): DepositoRow[] {
  let out = filterByDepositoLegal(rows, depositoLegal);

  const peel: OperativaFilterState = {
    ...filtros,
    gradas: [],
    cantidadOp: null,
    cantidadValor: null,
    cadenaComercial: null,
  };
  out = applyOperativaFilters(out, peel);

  if (filtros.cantidadOp != null && filtros.cantidadValor != null) {
    out = applyOperativaFilters(out, {
      ...peel,
      cantidadOp: filtros.cantidadOp,
      cantidadValor: filtros.cantidadValor,
    });
  }

  const cadena = String(filtros.cadenaComercial ?? "").trim().toUpperCase();
  if (cadena === "LIQUIDACION") {
    out = out.filter((r) => r.es_liquidacion === true);
  } else if (cadena && cadena !== "REGULAR") {
    out = out.filter((r) => String(r.cadena_comercial ?? "").toUpperCase() === cadena);
  } else if (cadena === "REGULAR") {
    out = out.filter((r) => r.es_liquidacion !== true);
  }

  return out;
}

export function countPeCards(rows: DepositoRow[]): number {
  const keys = new Set(
    rows.map(
      (p) =>
        `${p.linea_codigo_proveedor}-${p.referencia_codigo_proveedor}-${p.material_code}-${p.color_code}`,
    ),
  );
  return keys.size;
}
