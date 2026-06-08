/**
 * Agregación Cadena → Cliente → Marca en PostgreSQL (mismos filtros que `v_ventas_pivot`).
 * Claves: id_cadena, id_cliente, id_marca; las etiquetas son descripciones de FK (solo lectura en UI).
 */

import type { SalesReportFilters } from "@/modules/sales-report/types";
import type { FullSnapshotJerarquiaLeaf } from "./full-snapshot-types";
import { buildPivotWhereClause } from "./pivot-query";
import { variacionPctVsObjetivo } from "./variacion-objetivo";

const LINEAS_SUBQUERY = `
SELECT
  TRIM(t.descp_tipo) AS tipo,
  TRIM(m.descp_marca) AS marca,
  TRIM(c.descp_cliente) AS cliente,
  v.id_cliente::text AS codigo_cliente,
  v.id_cliente::integer AS id_cliente,
  TRIM(ven.descp_vendedor) AS vendedor,
  COALESCE(TRIM(cad.descp_cadena), 'Clientes sin cadenas') AS cadena,
  COALESCE(cad.id_cadena, 0)::integer AS id_cadena,
  EXTRACT(MONTH FROM v.fecha)::integer AS mes_idx,
  v.id_categoria,
  v.id_marca,
  EXTRACT(YEAR FROM v.fecha)::integer AS y,
  COALESCE(v.monto, 0)::numeric AS monto
FROM registro_ventas_general_v2 v
JOIN tipo_v2 t ON v.id_tipo = t.id_tipo
JOIN marca_v2 m ON v.id_marca = m.id_marca
JOIN cliente_v2 c ON v.id_cliente = c.id_cliente
JOIN vendedor_v2_deprecated ven ON v.id_vendedor = ven.id_vendedor
LEFT JOIN cliente_cadena_v2 cc ON v.id_cliente = cc.id_cliente
LEFT JOIN cadena_v2 cad ON cc.id_cadena = cad.id_cadena
`.trim();

export function buildJerarquiaSql(filters: SalesReportFilters): { text: string; values: unknown[] } {
  const { whereSql, values } = buildPivotWhereClause(filters, new Set(), { pivotAlias: "fl" });
  const text = `
SELECT
  fl.id_cadena,
  MAX(fl.cadena)::text AS descp_cadena,
  fl.id_cliente,
  MAX(fl.cliente)::text AS descp_cliente,
  fl.id_marca,
  MAX(fl.marca)::text AS descp_marca,
  SUM(CASE WHEN fl.y = 2026 THEN fl.monto ELSE 0 END)::float8 AS monto_26,
  SUM(CASE WHEN fl.y = 2025 THEN fl.monto ELSE 0 END)::float8 AS monto_25
FROM (${LINEAS_SUBQUERY}) AS fl
${whereSql}
GROUP BY fl.id_cadena, fl.id_cliente, fl.id_marca
ORDER BY SUM(CASE WHEN fl.y = 2026 THEN fl.monto ELSE 0 END) DESC NULLS LAST
`.trim();
  return { text, values };
}

export function mapJerarquiaQueryRows(
  rows: Record<string, unknown>[],
  objetivoPct: number
): FullSnapshotJerarquiaLeaf[] {
  const mult = 1 + objetivoPct / 100;
  return rows.map((r) => {
    const m25 = Number(r.monto_25) || 0;
    const m26 = Number(r.monto_26) || 0;
    const monto_obj = m25 * mult;
    return {
      id_cadena: Number(r.id_cadena) || 0,
      descp_cadena: String(r.descp_cadena ?? "Clientes sin cadenas"),
      id_cliente: Number(r.id_cliente) || 0,
      descp_cliente: String(r.descp_cliente ?? ""),
      id_marca: Number(r.id_marca) || 0,
      descp_marca: String(r.descp_marca ?? ""),
      monto_2025: m25,
      monto_2026: m26,
      monto_objetivo: monto_obj,
      variacion_vs_objetivo_pct: variacionPctVsObjetivo(monto_obj, m26),
    };
  });
}
