import { CATEGORIA_COMPRA_PREVIA_ID, CATEGORIA_PROGRAMADO_ID } from "@/lib/intencion-compra/categoria-ic";

/** CTE + join — categoría comercial PP (pp.categoria_id o IC vinculada). */
export const SQL_PP_CATEGORIA_CTE = `
  pp_cat AS (
    SELECT
      pp.id AS pp_id,
      COALESCE(
        pp.categoria_id,
        (
          SELECT ic.categoria_id
          FROM intencion_compra_pedido icp
          JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
          WHERE icp.pedido_proveedor_id = pp.id
          ORDER BY icp.id
          LIMIT 1
        )
      ) AS categoria_id
    FROM pedido_proveedor pp
  )
`;

export function sqlFilterPpCategoria(categoriaId: number, ppAlias = "pp"): string {
  return `EXISTS (
    SELECT 1 FROM pp_cat pc
    WHERE pc.pp_id = ${ppAlias}.id AND pc.categoria_id = ${categoriaId}
  )`;
}

export const SQL_FILTER_COMPRA_PREVIA = sqlFilterPpCategoria(CATEGORIA_COMPRA_PREVIA_ID);
export const SQL_FILTER_PROGRAMADO = sqlFilterPpCategoria(CATEGORIA_PROGRAMADO_ID);
