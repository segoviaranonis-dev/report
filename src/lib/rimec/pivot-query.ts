/**
 * SISTEMA: RIMEC Business Intelligence — pivot-query.ts
 * CLONACIÓN EXACTA de: core/queries.py v74.0.0
 * Consulta v_ventas_pivot y aplica objetivo_pct en TypeScript.
 *
 * Contrato de datos: la columna `marca` de v_ventas_pivot proviene de marca_v2.descp_marca
 * (ver migración 001_create_v_ventas_pivot). Listados de marcas en UI leen siempre la tabla
 * maestra `marca_v2` para catálogo y cascada (Sales Report es un mundo de lectura aparte del
 * holding; en el futuro el flujo de facturación / “agua viva” podrá alimentar la misma dimensión).
 */

import {
  ALIAS_CURRENT_VALUE,
  ALIAS_TARGET_VALUE,
  ALIAS_VARIATION,
  MES_MAP,
} from "@/modules/sales-report/constants";
import type { SalesReportFilters } from "@/modules/sales-report/types";
import { variacionPctVsObjetivo } from "./variacion-objetivo";

/** Omite una dimensión al armar el WHERE (dominios en cascada tipo Streamlit). */
export type PivotFilterOmit =
  | "meses"
  | "tipo"
  | "categoria"
  | "cliente_exacto"
  | "vendedor"
  | "marca"
  | "cadena"
  | "cliente";

export type PivotWhereBuildOptions = {
  /** Si se define (p. ej. `v`), todas las columnas del pivot van calificadas para subconsultas / JOIN. */
  pivotAlias?: string;
};

function pivotCol(alias: string | undefined, col: string): string {
  return alias ? `${alias}.${col}` : col;
}

/**
 * Construye WHERE + parámetros. `omit` excluye condiciones de esa dimensión para listar valores posibles.
 */
export function buildPivotWhereClause(
  filters: SalesReportFilters,
  omit: ReadonlySet<PivotFilterOmit> = new Set(),
  options?: PivotWhereBuildOptions
): { whereSql: string; values: unknown[] } {
  const v = options?.pivotAlias;
  const conditions: string[] = [];
  const values: unknown[] = [];
  let n = 1;
  const p = (col: string) => pivotCol(v, col);

  if (!omit.has("meses")) {
    const mesIds = filters.meses
      .map((m) => MES_MAP[m])
      .filter((x): x is number => typeof x === "number");
    if (mesIds.length > 0 && mesIds.length < 12) {
      conditions.push(`${p("mes_idx")} = ANY($${n}::int[])`);
      values.push(mesIds);
      n += 1;
    }
  }

  if (!omit.has("tipo")) {
    const depto = (filters.departamento || "").trim().toUpperCase();
    if (!depto || ["GLOBAL", "ALL"].includes(depto)) {
      // Sin filtro por tipo (toda la vista).
    } else if (depto === "TODOS") {
      conditions.push(
        `(UPPER(TRIM(${p("tipo")}::text)) LIKE '%CALZAD%' OR UPPER(TRIM(${p("tipo")}::text)) LIKE '%CONFEC%')`
      );
    } else {
      conditions.push(`${p("tipo")} = $${n}`);
      values.push(depto);
      n += 1;
    }
  }

  if (!omit.has("categoria")) {
    const catIds = filters.categoria_ids.filter((c) => c && Number(c) !== 0);
    if (catIds.length) {
      conditions.push(`${p("id_categoria")} = ANY($${n}::int[])`);
      values.push(catIds);
      n += 1;
    }
  }

  if (!omit.has("cliente_exacto")) {
    const idExacto = (filters.id_cliente_exacto || "").trim();
    if (idExacto) {
      conditions.push(`${p("codigo_cliente")} = $${n}`);
      values.push(idExacto);
      n += 1;
    }
  }

  const addInText = (vals: string[], col: string) => {
    const clean = vals
      .map((x) => String(x).trim())
      .filter((x) => x && x.toUpperCase() !== "TODOS");
    if (!clean.length) return;
    conditions.push(`${p(col)} = ANY($${n}::text[])`);
    values.push(clean);
    n += 1;
  };

  if (!omit.has("vendedor")) addInText(filters.vendedores, "vendedor");
  if (!omit.has("marca")) addInText(filters.marcas, "marca");
  if (!omit.has("cadena")) addInText(filters.cadenas, "cadena");
  if (!omit.has("cliente")) addInText(filters.clientes, "cliente");

  const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
  return { whereSql: where, values };
}

export function buildPivotSql(filters: SalesReportFilters): { text: string; values: unknown[] } {
  const { whereSql, values } = buildPivotWhereClause(filters, new Set());
  return { text: `SELECT * FROM v_ventas_pivot${whereSql}`, values };
}

/**
 * Post-procesamiento EXACTO de queries.py líneas 64-92
 * Aplica objetivo_pct y calcula variaciones EN CÓDIGO (no en BD)
 */
export function enrichPivotRows(
  rows: Record<string, unknown>[],
  objetivoPct: number
): Record<string, unknown>[] {
  const mult = 1 + objetivoPct / 100;
  const CANT_OBJ = "Cant. Obj";
  const CANT_ACT = "Cant. 2026";
  const CANT_VAR = "Cant. V. %";

  const cleanTxt = (v: unknown) => {
    const s = String(v ?? "")
      .trim()
      .toUpperCase();
    if (["NAN", "NONE", "NULL", "NONETYPE", "<NA>", ""].includes(s)) return "S/I";
    return String(v ?? "")
      .trim()
      .toUpperCase();
  };

  return rows.map((r) => {
    const m25 = Number(r.monto_25) || 0;
    const m26 = Number(r.monto_26) || 0;
    const tgt = m25 * mult;
    const vari = variacionPctVsObjetivo(tgt, m26);

    const out: Record<string, unknown> = { ...r };
    out[ALIAS_CURRENT_VALUE] = m26;
    out[ALIAS_TARGET_VALUE] = tgt;
    out[ALIAS_VARIATION] = vari;

    if ("cant_25" in r && "cant_26" in r) {
      const c25 = Number(r.cant_25) || 0;
      const c26 = Number(r.cant_26) || 0;
      const cObj = c25 * mult;
      const cVar = variacionPctVsObjetivo(cObj, c26);
      out[CANT_OBJ] = cObj;
      out[CANT_ACT] = c26;
      out[CANT_VAR] = cVar;
    }

    for (const col of ["tipo", "marca", "cliente", "vendedor", "cadena"] as const) {
      if (col in out) out[col] = cleanTxt(out[col]);
    }

    return out;
  });
}
