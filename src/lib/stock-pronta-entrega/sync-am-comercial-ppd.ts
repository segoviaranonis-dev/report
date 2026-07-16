import type { Pool } from "pg";

/** Sincroniza columnas AM en PPD desde sdrm_articulo_comercial + pilares (post mapa). */
export async function syncAmComercialPpd(pool: Pool, batch: string): Promise<{
  ppd_actualizados: number;
}> {
  const { rowCount } = await pool.query(
    `
    WITH src AS (
      SELECT
        ppd.id AS ppd_id,
        COALESCE(sac.cadena_comercial, 'REGULAR') AS cadena_comercial,
        COALESCE(sac.es_liquidacion, false) AS es_liquidacion,
        COALESCE(sac.cod_grupo, pe_stg.cod_grupo) AS cod_grupo,
        CASE
          WHEN pp.proveedor_importacion_id = 638 THEN
            COALESCE(
              NULLIF(btrim(t1.descp_tipo_1), ''),
              NULLIF(upper(btrim(sac.tipo1)), '')
            )
          ELSE NULL
        END AS temporada
      FROM pedido_proveedor_detalle ppd
      JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
      LEFT JOIN LATERAL (
        SELECT
          NULLIF(btrim(s.codigo_barras), '') AS codigo_barras,
          NULLIF(btrim(s.cod_grupo), '') AS cod_grupo
        FROM stock_pe_staging_migrated m
        JOIN stock_pronta_entrega_rimec s ON s.id = m.staging_id
        WHERE m.ppd_id = ppd.id
        ORDER BY s.id
        LIMIT 1
      ) pe_stg ON true
      LEFT JOIN sdrm_articulo_comercial sac
        ON lower(btrim(sac.batch_label)) = lower(btrim($1))
       AND btrim(sac.codigo_barras) = btrim(pe_stg.codigo_barras)
      LEFT JOIN linea l
        ON l.proveedor_id = pp.proveedor_importacion_id
       AND l.codigo_proveedor::text = btrim(ppd.linea)
      LEFT JOIN referencia r
        ON r.linea_id = l.id
       AND r.codigo_proveedor::text = btrim(ppd.referencia)
      LEFT JOIN linea_referencia lr
        ON lr.linea_id = l.id AND lr.referencia_id = r.id
      LEFT JOIN tipo_1 t1 ON t1.id_tipo_1 = lr.tipo_1_id
      WHERE pp.entidad_comercial = 'STOCK'
        AND pp.deposito_codigo IS NOT NULL
        AND lower(btrim(pp.numero_proforma)) = lower(btrim($1))
    )
    UPDATE pedido_proveedor_detalle ppd
    SET
      am_cadena_comercial = src.cadena_comercial,
      am_es_liquidacion = src.es_liquidacion,
      am_cod_grupo = src.cod_grupo,
      am_temporada = src.temporada
    FROM src
    WHERE ppd.id = src.ppd_id
    `,
    [batch],
  );

  return { ppd_actualizados: rowCount ?? 0 };
}
