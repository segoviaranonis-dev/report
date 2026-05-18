/**
 * Dominios de filtros en cascada (modelo tipo Streamlit / última consulta):
 * la mayoría = DISTINCT sobre v_ventas_pivot con filtros (omitir la dimensión que se repuebla).
 * Marcas: se devuelven textos desde la tabla maestra `marca_v2`, acotadas a marcas que aparecen
 * en el pivot con los filtros actuales (JOIN explícito; la vista ya proyecta marca desde m.descp_marca).
 * Cliente/cadena: mismas columnas que consume RIMEC Web y Sales Report (`cliente_v2` / `cadena_v2` vía
 * la vista y `cliente_cadena_v2` en el GROUP BY del DDL); la importadora puede reforzar joins a
 * `cliente_cadena_v2` en catálogo cuando el flujo lo requiera.
 */

import type { Pool } from "pg";
import { MES_MAP, MES_NOMBRES } from "@/modules/sales-report/constants";
import type { SalesReportFilters } from "@/modules/sales-report/types";
import type { FullSnapshotCascada } from "./full-snapshot-types";
import { buildPivotWhereClause, type PivotFilterOmit } from "./pivot-query";

function uniqSortedStrings(rows: { v: string | null }[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    const s = (r.v ?? "").trim();
    if (!s || s === "S/I" || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  out.sort((a, b) => a.localeCompare(b, "es"));
  return out;
}

async function distinctText(
  pool: Pool,
  filtros: SalesReportFilters,
  omit: PivotFilterOmit,
  column: string
): Promise<string[]> {
  const { whereSql, values } = buildPivotWhereClause(filtros, new Set([omit]));
  const sql = `
    SELECT DISTINCT TRIM(BOTH FROM ${column}::text) AS v
    FROM v_ventas_pivot
    ${whereSql}
    ORDER BY 1 NULLS LAST
    LIMIT 8000
  `;
  const r = await pool.query<{ v: string | null }>(sql, values);
  return uniqSortedStrings(r.rows);
}

async function distinctMeses(
  pool: Pool,
  filtros: SalesReportFilters
): Promise<string[]> {
  const { whereSql, values } = buildPivotWhereClause(filtros, new Set(["meses"]));
  const sql = `
    SELECT DISTINCT mes_idx::int AS idx
    FROM v_ventas_pivot
    ${whereSql}
    ORDER BY 1 NULLS LAST
  `;
  const r = await pool.query<{ idx: number | null }>(sql, values);
  const names: string[] = [];
  const seen = new Set<string>();
  for (const row of r.rows) {
    const idx = row.idx;
    if (idx === null || idx < 1 || idx > 12) continue;
    const name = MES_NOMBRES[idx];
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  names.sort((a, b) => (MES_MAP[a] ?? 0) - (MES_MAP[b] ?? 0));
  return names;
}

async function distinctTipos(pool: Pool, filtros: SalesReportFilters): Promise<string[]> {
  const raw = await distinctText(pool, filtros, "tipo", "tipo");
  const out = ["TODOS", ...raw.filter((t) => t.toUpperCase() !== "TODOS")];
  return [...new Set(out)];
}

async function distinctCategorias(
  pool: Pool,
  filtros: SalesReportFilters
): Promise<{ id_categoria: number; nombre: string }[]> {
  const { whereSql, values } = buildPivotWhereClause(filtros, new Set(["categoria"]));
  const sql = `SELECT DISTINCT id_categoria::int AS id FROM v_ventas_pivot${whereSql} ORDER BY 1`;
  const r = await pool.query<{ id: number | null }>(sql, values);
  const ids = [...new Set(r.rows.map((x) => x.id).filter((x): x is number => typeof x === "number" && x > 0))];
  if (!ids.length) return [];

  const cat = await pool.query<{ id_categoria: number; nombre: string }>(
    `SELECT id_categoria, TRIM(descp_categoria) AS nombre FROM categoria_v2 WHERE id_categoria = ANY($1::int[]) ORDER BY id_categoria`,
    [ids]
  );
  return cat.rows.map((x) => ({ id_categoria: x.id_categoria, nombre: x.nombre || `#${x.id_categoria}` }));
}

/** Marcas desde `marca_v2`, solo las que existen en filas del pivot con filtros (sin filtrar por marca). */
async function distinctMarcasDesdeMaestro(pool: Pool, filtros: SalesReportFilters): Promise<string[]> {
  const { whereSql, values } = buildPivotWhereClause(filtros, new Set(["marca"]), { pivotAlias: "v" });
  const sql = `
    SELECT DISTINCT TRIM(BOTH FROM m.descp_marca::text) AS v
    FROM marca_v2 m
    INNER JOIN (
      SELECT DISTINCT TRIM(BOTH FROM v.marca::text) AS marca_pivot
      FROM v_ventas_pivot v
      ${whereSql}
    ) sub ON TRIM(UPPER(sub.marca_pivot)) = TRIM(UPPER(m.descp_marca::text))
    ORDER BY 1 NULLS LAST
    LIMIT 8000
  `;
  const r = await pool.query<{ v: string | null }>(sql, values);
  return uniqSortedStrings(r.rows);
}

export async function fetchCascadeDomains(pool: Pool, filtros: SalesReportFilters): Promise<FullSnapshotCascada> {
  const [departamentos, categorias, meses_nombres, marcas, cadenas, vendedores] = await Promise.all([
    distinctTipos(pool, filtros),
    distinctCategorias(pool, filtros),
    distinctMeses(pool, filtros),
    distinctMarcasDesdeMaestro(pool, filtros),
    distinctText(pool, filtros, "cadena", "cadena"),
    distinctText(pool, filtros, "vendedor", "vendedor"),
  ]);

  return { departamentos, categorias, meses_nombres, marcas, cadenas, vendedores };
}
