import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import {
  applyOperativaFilters,
  buildOperativaOpciones,
  type OperativaFilterState,
  type OperativaOpciones,
} from "@/lib/depositos/operativa-filters";
import { esFilaModuloAccesorios, esRamoAccesorios, mergePeAbcrTipo1Items, peTieneSubfamiliaAccesorios } from "@/lib/filtros/modulo-accesorios";
import {
  esLiquidacionRow,
  esPromoRow,
} from "@/lib/filtros/filtro-tipo-canonico";
import {
  parsePeTipoSelected,
  peTipoIdFromCadena,
  rowMatchesPeTipoDiccionario,
  type PeTipoDiccionarioId,
} from "@/lib/stock-pronta-entrega/filtro-tipo-pe-diccionario";
import {
  materialTokenFiltroPe,
  colorTokenFiltroPe,
  stampFamiliaPilaresPe,
} from "@/lib/stock-pronta-entrega/pe-filtro-pilar-638";
import { esComunRow } from "@/lib/stock-pronta-entrega/pe-grupo-uno-visual";

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
  const stamped = stampFamiliaPilaresPe(baseRows);
  const sinGrada = { ...filtros, gradas: [] };
  const opciones = buildOperativaOpciones(stamped, sinGrada, {
    materialToken: materialTokenFiltroPe,
    colorToken: colorTokenFiltroPe,
  });
  return {
    ...opciones,
    gradas: [],
    tipo1: mergePeAbcrTipo1Items(opciones.tipo1),
  };
}

/**
 * Filtros Stock PE — COMERCIAL usa diccionario PE (LIQ · Promo · Común · Normal).
 */
function peTipoSeleccion(filtros: OperativaFilterState): PeTipoDiccionarioId[] {
  const fromSidebar = parsePeTipoSelected(filtros.tipoGrupos);
  if (fromSidebar.length) return fromSidebar;
  const cadena = String(filtros.cadenaComercial ?? "").trim();
  if (!cadena) return [];
  return [peTipoIdFromCadena(cadena)];
}

export function applyStockPeFilters(
  rows: DepositoRow[],
  filtros: OperativaFilterState,
  depositoLegal: string,
): DepositoRow[] {
  let out = filterByDepositoLegal(rows, depositoLegal);

  const subfamiliaAcc = peTieneSubfamiliaAccesorios(filtros.tipo1Ids);
  const ramo = String(filtros.ramoTipo ?? "").trim().toUpperCase();
  const ramoOperativa =
    subfamiliaAcc || esRamoAccesorios(ramo) ? ("ACCESORIOS" as const) : filtros.ramoTipo;

  if (subfamiliaAcc || esRamoAccesorios(ramo)) {
    out = out.filter((r) => esFilaModuloAccesorios(r));
  } else {
    out = out.filter((r) => !esFilaModuloAccesorios(r));
  }

  out = stampFamiliaPilaresPe(out);

  const peel: OperativaFilterState = {
    ...filtros,
    ramoTipo: ramoOperativa,
    gradas: [],
    cantidadOp: null,
    cantidadValor: null,
    cadenaComercial: null,
    tipoGrupos: [],
  };
  out = applyOperativaFilters(out, peel);

  if (filtros.cantidadOp != null && filtros.cantidadValor != null) {
    out = applyOperativaFilters(out, {
      ...peel,
      cantidadOp: filtros.cantidadOp,
      cantidadValor: filtros.cantidadValor,
    });
  }

  const tipoPe = peTipoSeleccion(filtros);
  if (tipoPe.length) {
    out = out.filter((r) => rowMatchesPeTipoDiccionario(r, tipoPe));
  } else {
    const cadena = String(filtros.cadenaComercial ?? "").trim().toUpperCase();
    if (cadena === "LIQUIDACION") {
      out = out.filter((r) => esLiquidacionRow(r));
    } else if (cadena === "PROMOCIONAL") {
      out = out.filter((r) => !esLiquidacionRow(r) && esPromoRow(r));
    } else if (cadena === "COMUN") {
      out = out.filter((r) => esComunRow(r));
    } else if (cadena === "REGULAR") {
      out = out.filter((r) => !esLiquidacionRow(r) && !esPromoRow(r) && !esComunRow(r));
    }
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
