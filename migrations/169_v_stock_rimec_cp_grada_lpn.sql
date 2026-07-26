-- MIG-169 — v_stock_rimec CP 638: grada texto + LPN por fila PPD (agrupación tallas por LP)
-- Doc: report/docs/GRADA_ABIERTA_638_ALEJANDRO_MAGNO.md · clave (linea, ref, mat, color, grada, precio_lpn)

CREATE OR REPLACE VIEW public.v_stock_rimec AS
SELECT DISTINCT ON (ppd.id)
  ppd.id AS det_id,
  pp.id AS pp_id,
  pp.numero_registro AS pp_nro,
  COALESCE(pp.numero_proforma, ''::text) AS proforma,
  pp.fecha_arribo_estimada::text AS eta,
  pp.quincena_arribo_id,
  qa.descripcion AS quincena_desc,
  pp.estado AS pp_estado,
  ppd.id_marca::bigint AS marca_id,
  COALESCE(mv.descp_marca, '—'::text) AS descp_marca,
  COALESCE(lr.linea_id, l.id, x.cast_linea_id) AS linea_id,
  COALESCE(lr.referencia_id, ref_j.id, x.cast_referencia_id) AS referencia_id,
  COALESCE(lr.grupo_estilo_id, x.cast_style_id) AS grupo_estilo_id,
  lr.tipo_1_id,
  COALESCE(ppd.linea, ''::text) AS linea_codigo,
  COALESCE(ppd.referencia, ''::text) AS referencia_codigo,
  COALESCE(COALESCE(lr.grupo_estilo_id, x.cast_style_id)::text, btrim(COALESCE(ppd.style_code, ''::text)), ''::text) AS style_code,
  COALESCE(ppd.nombre, ''::text) AS nombre,
  COALESCE(ppd.material_code, ''::text) AS material_code,
  COALESCE(ppd.descp_material, ''::text) AS descp_material,
  COALESCE(ppd.color_code, ''::text) AS color_code,
  COALESCE(ppd.descp_color, ''::text) AS descp_color,
  col_j.hex_web AS color_hex,
  ppd.grades_json,
  COALESCE(ppd.cantidad_cajas, 0) AS cantidad_cajas,
  COALESCE(ppd.cantidad_pares, 0) AS cantidad_pares,
  COALESCE(ppd.pares_vendidos, 0) AS pares_vendidos,
  GREATEST(0, COALESCE(ppd.cantidad_pares, 0) - COALESCE(ppd.pares_vendidos, 0)) AS saldo_pares,
  CASE
    WHEN pp.proveedor_importacion_id = 638 OR ppd.am_modo_venta = 'UNIDAD' THEN 1
    WHEN COALESCE(ppd.cantidad_cajas, 0) > 0 THEN ppd.cantidad_pares / ppd.cantidad_cajas
    ELSE 0
  END AS pares_por_caja,
  CASE
    WHEN pp.proveedor_importacion_id = 638 OR ppd.am_modo_venta = 'UNIDAD' THEN
      GREATEST(0, ROUND(GREATEST(0, COALESCE(ppd.cantidad_pares, 0) - COALESCE(ppd.pares_vendidos, 0))))::integer
    ELSE GREATEST(0, COALESCE(ppd.cantidad_cajas, 0) -
      CASE WHEN COALESCE(ppd.cantidad_cajas, 0) > 0 AND COALESCE(ppd.cantidad_pares, 0) > 0
        THEN (COALESCE(ppd.pares_vendidos, 0) + ppd.cantidad_pares / ppd.cantidad_cajas - 1) / (ppd.cantidad_pares / ppd.cantidad_cajas)
        ELSE COALESCE(ppd.pares_vendidos, 0) END)::integer
  END AS cajas_disponibles,
  ppd.unit_fob_ajustado,
  COALESCE(ppd.precio_lpn, pl.lpn, 0::numeric) AS lpn,
  COALESCE(ppd.precio_lpc02, pl.lpc02) AS lpc02,
  COALESCE(ppd.precio_lpc03, pl.lpc03) AS lpc03,
  COALESCE(ppd.precio_lpc04, pl.lpc04) AS lpc04,
  pl.nombre_caso_aplicado AS caso_precio,
  pl.caso_id,
  pl.nombre_caso_aplicado AS descp_caso,
  COALESCE(lr.descp_grupo_estilo, ge.descp_grupo_estilo, ''::text) AS descp_grupo_estilo,
  COALESCE(lr.descp_tipo_1, t1.descp_tipo_1, ''::text) AS descp_tipo_1,
  CASE
    WHEN pp.proveedor_importacion_id = 638
     AND NULLIF(btrim(ppd.linea), '') IS NOT NULL
     AND NULLIF(regexp_replace(COALESCE(col_j.nombre, ppd.descp_color, ''), '^[Kk]', ''), '') IS NOT NULL
    THEN 'https://extrlcvcgypwazxipvqm.supabase.co/storage/v1/object/public/productos/'
         || btrim(ppd.linea) || '_'
         || regexp_replace(COALESCE(col_j.nombre, ppd.descp_color, ''), '^[Kk]', '') || '.jpg'
    WHEN COALESCE(ppd.linea, ''::text) <> '' AND COALESCE(ppd.referencia, ''::text) <> ''
     AND COALESCE(ppd.material_code, ''::text) <> '' AND COALESCE(ppd.color_code, ''::text) <> ''
    THEN 'https://extrlcvcgypwazxipvqm.supabase.co/storage/v1/object/public/productos/'
         || ppd.linea || '-' || ppd.referencia || '-' || ppd.material_code || '-' || ppd.color_code || '.jpg'
    ELSE NULL::text
  END AS imagen_url,
  'TRÁNSITO_PP'::text AS origen_tipo,
  NULL::bigint AS deposito_id,
  NULL::bigint AS clasificacion_stock_id,
  NULL::text AS deposito_nombre,
  NULL::text AS clasificacion_stock_descp,
  col_j.tono_canon AS color_tono_canon,
  l.genero_id,
  gen.codigo AS genero_codigo,
  gen.descripcion AS descp_genero,
  CASE
    WHEN pp.proveedor_importacion_id = 638 OR ppd.am_modo_venta = 'UNIDAD' THEN 'CONFECCIONES'::text
    ELSE 'CALZADO'::text
  END AS ramo_tipo,
  pp.proveedor_importacion_id,
  CASE
    WHEN pp.proveedor_importacion_id = 638 THEN 2
    WHEN pp.proveedor_importacion_id = 654 THEN 1
    ELSE NULL::integer
  END AS tipo_v2_id,
  NULLIF(btrim(ppd.grada), ''::text) AS grada,
  NULLIF(btrim(pp.nro_pedido_externo), ''::text) AS numero_preventa
FROM pedido_proveedor_detalle ppd
JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
LEFT JOIN quincena_arribo qa ON qa.id = pp.quincena_arribo_id
LEFT JOIN marca_v2 mv ON mv.id_marca = ppd.id_marca
LEFT JOIN material m ON m.codigo_proveedor::text = ppd.material_code AND m.proveedor_id = pp.proveedor_importacion_id
LEFT JOIN linea l ON l.codigo_proveedor::text = ppd.linea AND l.proveedor_id = pp.proveedor_importacion_id
LEFT JOIN genero gen ON gen.id = l.genero_id
LEFT JOIN color col_j ON col_j.codigo_proveedor::text = ppd.color_code AND col_j.proveedor_id = pp.proveedor_importacion_id AND col_j.activo = true
LEFT JOIN referencia ref_j ON ref_j.codigo_proveedor::text = ppd.referencia AND ref_j.linea_id = l.id
CROSS JOIN LATERAL (
  SELECT
    CASE WHEN NULLIF(btrim(ppd.linea), '') ~ '^[0-9]+$' THEN btrim(ppd.linea)::bigint ELSE NULL::bigint END AS cast_linea_id,
    CASE WHEN NULLIF(btrim(ppd.referencia), '') ~ '^[0-9]+$' THEN btrim(ppd.referencia)::bigint ELSE NULL::bigint END AS cast_referencia_id,
    CASE WHEN NULLIF(btrim(ppd.style_code), '') ~ '^[0-9]+$' THEN btrim(ppd.style_code)::bigint ELSE NULL::bigint END AS cast_style_id
) x
LEFT JOIN linea_referencia lr ON lr.linea_id = l.id AND lr.referencia_id = ref_j.id
LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = COALESCE(lr.grupo_estilo_id, x.cast_style_id)
LEFT JOIN tipo_1 t1 ON t1.id_tipo_1 = lr.tipo_1_id
LEFT JOIN LATERAL (
  SELECT icp2.precio_evento_id FROM intencion_compra_pedido icp2
  JOIN intencion_compra ic2 ON ic2.id = icp2.intencion_compra_id
  WHERE icp2.pedido_proveedor_id = pp.id AND icp2.precio_evento_id IS NOT NULL
    AND (ppd.id_marca IS NULL OR ic2.id_marca = ppd.id_marca::bigint)
  ORDER BY (CASE WHEN ppd.id_marca IS NOT NULL AND ic2.id_marca = ppd.id_marca::bigint THEN 0 ELSE 1 END), icp2.id
  LIMIT 1
) ev ON true
LEFT JOIN LATERAL (
  SELECT pl2.lpn, pl2.lpc02, pl2.lpc03, pl2.lpc04, pl2.nombre_caso_aplicado, pl2.caso_id
  FROM precio_lista pl2
  WHERE pl2.evento_id = ev.precio_evento_id AND pl2.linea_id = COALESCE(l.id, ref_j.linea_id)
    AND pl2.referencia_id = ref_j.id AND pl2.material_id = m.id
  LIMIT 1
) pl ON true
WHERE pp.estado_transito = 'EN_TRANSITO'
  AND COALESCE(pp.categoria_id, (
    SELECT ic.categoria_id FROM intencion_compra_pedido icp
    JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
    WHERE icp.pedido_proveedor_id = pp.id ORDER BY icp.id LIMIT 1
  )) = 2
  AND ppd.referencia IS NOT NULL
  AND GREATEST(0, COALESCE(ppd.cantidad_pares, 0) - COALESCE(ppd.pares_vendidos, 0)) > 0
ORDER BY ppd.id;

COMMENT ON VIEW public.v_stock_rimec IS
  'Catálogo RIMEC Web CP · TRÁNSITO_PP · MIG-169 confecciones 638 grada + LPN por fila';
