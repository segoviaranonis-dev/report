-- MIG-152 — CAT-LAT-T2/T3: RPC meta filtros + ramo_tipo en vista PE

DROP VIEW IF EXISTS public.v_stock_pe_rimec CASCADE;

CREATE VIEW public.v_stock_pe_rimec AS
SELECT
  ppd.id AS det_id,
  pp.id AS pp_id,
  pp.numero_registro AS pp_nro,
  COALESCE(pp.numero_proforma, ''::text) AS proforma,
  NULL::text AS eta,
  pp.quincena_arribo_id,
  qa.descripcion AS quincena_desc,
  pp.estado AS pp_estado,
  COALESCE(ppd.id_marca, l.marca_id, 0)::bigint AS marca_id,
  COALESCE(mv.descp_marca, mv_l.descp_marca, 'RIMEC'::text) AS descp_marca,
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
    WHEN GREATEST(0, COALESCE(ppd.cantidad_pares, 0) - COALESCE(ppd.pares_vendidos, 0)) > 0
    THEN GREATEST(0, COALESCE(ppd.cantidad_pares, 0) - COALESCE(ppd.pares_vendidos, 0))
    ELSE 0
  END AS pares_por_caja,
  GREATEST(0, ROUND(GREATEST(0, COALESCE(ppd.cantidad_pares, 0) - COALESCE(ppd.pares_vendidos, 0))))::integer AS cajas_disponibles,
  ppd.unit_fob_ajustado,
  COALESCE(ppd.unit_fob_ajustado, 0)::numeric AS lpn,
  NULL::numeric AS lpc02,
  NULL::numeric AS lpc03,
  NULL::numeric AS lpc04,
  NULL::text AS caso_precio,
  NULL::bigint AS caso_id,
  ('PE · ' || COALESCE(pp.numero_proforma, ''::text))::text AS descp_caso,
  COALESCE(lr.descp_grupo_estilo, ge.descp_grupo_estilo, ''::text) AS descp_grupo_estilo,
  COALESCE(lr.descp_tipo_1, t1.descp_tipo_1, ''::text) AS descp_tipo_1,
  CASE
    WHEN pp.proveedor_importacion_id = 638
     AND NULLIF(btrim(ppd.linea), '') IS NOT NULL
     AND NULLIF(regexp_replace(COALESCE(pe_img.excel_color_code, col_j.nombre, ''), '^[Kk]', ''), '') IS NOT NULL
    THEN 'https://extrlcvcgypwazxipvqm.supabase.co/storage/v1/object/public/productos/'
         || btrim(ppd.linea) || '_'
         || regexp_replace(COALESCE(pe_img.excel_color_code, col_j.nombre), '^[Kk]', '') || '.jpg'
    WHEN COALESCE(ppd.linea, ''::text) <> '' AND COALESCE(ppd.referencia, ''::text) <> ''
     AND COALESCE(ppd.material_code, ''::text) <> '' AND COALESCE(ppd.color_code, ''::text) <> ''
    THEN 'https://extrlcvcgypwazxipvqm.supabase.co/storage/v1/object/public/productos/'
         || ppd.linea || '-' || ppd.referencia || '-' || ppd.material_code || '-' || ppd.color_code || '.jpg'
    ELSE NULL::text
  END AS imagen_url,
  'PRONTA_ENTREGA'::text AS origen_tipo,
  NULL::bigint AS deposito_id,
  NULL::bigint AS clasificacion_stock_id,
  pp.deposito_codigo AS deposito_nombre,
  NULL::text AS clasificacion_stock_descp,
  pp.proveedor_importacion_id,
  CASE pp.proveedor_importacion_id WHEN 654 THEN 1 WHEN 638 THEN 2 ELSE NULL::integer END AS tipo_v2_id,
  NULLIF(regexp_replace(COALESCE(pe_img.excel_color_code, col_j.nombre, ''), '^[Kk]', ''), '') AS imagen_color_excel,
  NULLIF(btrim(ppd.grada), ''::text) AS grada,
  col_j.tono_canon AS color_tono_canon,
  l.genero_id,
  gen.codigo AS genero_codigo,
  gen.descripcion AS descp_genero,
  CASE
    WHEN pp.proveedor_importacion_id = 638 THEN 'CONFECCIONES'
    WHEN pp.proveedor_importacion_id = 654 THEN 'CALZADO'
    ELSE 'CALZADO'
  END AS ramo_tipo
FROM pedido_proveedor_detalle ppd
JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
JOIN quincena_arribo qa ON qa.id = pp.quincena_arribo_id
CROSS JOIN LATERAL (
  SELECT
    CASE WHEN NULLIF(btrim(ppd.linea), '') ~ '^[0-9]+$' THEN btrim(ppd.linea)::bigint ELSE NULL::bigint END AS cast_linea_id,
    CASE WHEN NULLIF(btrim(ppd.referencia), '') ~ '^[0-9]+$' THEN btrim(ppd.referencia)::bigint ELSE NULL::bigint END AS cast_referencia_id,
    CASE WHEN NULLIF(btrim(ppd.material_code), '') ~ '^[0-9]+$' THEN btrim(ppd.material_code)::bigint ELSE NULL::bigint END AS cast_material_id,
    CASE WHEN NULLIF(btrim(ppd.color_code), '') ~ '^[0-9]+$' THEN btrim(ppd.color_code)::bigint ELSE NULL::bigint END AS cast_color_id,
    CASE WHEN NULLIF(btrim(ppd.style_code), '') ~ '^[0-9]+$' THEN btrim(ppd.style_code)::bigint ELSE NULL::bigint END AS cast_style_id
) x
LEFT JOIN LATERAL (
  SELECT NULLIF(btrim(s.excel_color_code), '') AS excel_color_code
  FROM stock_pe_staging_migrated m
  JOIN stock_pronta_entrega_rimec s ON s.id = m.staging_id
  WHERE m.ppd_id = ppd.id
  ORDER BY s.id LIMIT 1
) pe_img ON TRUE
LEFT JOIN marca_v2 mv ON mv.id_marca = ppd.id_marca
LEFT JOIN linea l ON l.proveedor_id = pp.proveedor_importacion_id AND l.codigo_proveedor = x.cast_linea_id
LEFT JOIN genero gen ON gen.id = l.genero_id
LEFT JOIN marca_v2 mv_l ON mv_l.id_marca = l.marca_id
LEFT JOIN material m ON m.proveedor_id = pp.proveedor_importacion_id AND m.codigo_proveedor = x.cast_material_id
LEFT JOIN color col_j ON col_j.proveedor_id = pp.proveedor_importacion_id AND col_j.codigo_proveedor = x.cast_color_id AND col_j.activo = true
LEFT JOIN referencia ref_j ON ref_j.linea_id = l.id AND ref_j.codigo_proveedor = x.cast_referencia_id
LEFT JOIN linea_referencia lr ON lr.linea_id = l.id AND lr.referencia_id = ref_j.id
LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = COALESCE(lr.grupo_estilo_id, x.cast_style_id)
LEFT JOIN tipo_1 t1 ON t1.id_tipo_1 = lr.tipo_1_id
WHERE pp.entidad_comercial = 'STOCK'
  AND pp.deposito_codigo IS NOT NULL
  AND pp.estado_transito = 'EN_DEPOSITO'
  AND pp.categoria_id = 1
  AND pp.quincena_arribo_id = 25
  AND GREATEST(0, COALESCE(ppd.cantidad_pares, 0) - COALESCE(ppd.pares_vendidos, 0)) > 0;

COMMENT ON VIEW public.v_stock_pe_rimec IS
  'Pronta entrega RIMEC · MIG-152 ramo_tipo + MIG-151 enrich';

-- CP: ramo_tipo al final (CREATE OR REPLACE)
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
  CASE WHEN COALESCE(ppd.cantidad_cajas, 0) > 0 THEN ppd.cantidad_pares / ppd.cantidad_cajas ELSE 0 END AS pares_por_caja,
  GREATEST(0, COALESCE(ppd.cantidad_cajas, 0) -
    CASE WHEN COALESCE(ppd.cantidad_cajas, 0) > 0 AND COALESCE(ppd.cantidad_pares, 0) > 0
      THEN (COALESCE(ppd.pares_vendidos, 0) + ppd.cantidad_pares / ppd.cantidad_cajas - 1) / (ppd.cantidad_pares / ppd.cantidad_cajas)
      ELSE COALESCE(ppd.pares_vendidos, 0) END)::integer AS cajas_disponibles,
  ppd.unit_fob_ajustado,
  pl.lpn, pl.lpc02, pl.lpc03, pl.lpc04,
  pl.nombre_caso_aplicado AS caso_precio,
  pl.caso_id,
  pl.nombre_caso_aplicado AS descp_caso,
  COALESCE(lr.descp_grupo_estilo, ge.descp_grupo_estilo, ''::text) AS descp_grupo_estilo,
  COALESCE(lr.descp_tipo_1, t1.descp_tipo_1, ''::text) AS descp_tipo_1,
  CASE WHEN COALESCE(ppd.linea, ''::text) <> '' AND COALESCE(ppd.referencia, ''::text) <> ''
    AND COALESCE(ppd.material_code, ''::text) <> '' AND COALESCE(ppd.color_code, ''::text) <> ''
    THEN 'https://extrlcvcgypwazxipvqm.supabase.co/storage/v1/object/public/productos/'
         || ppd.linea || '-' || ppd.referencia || '-' || ppd.material_code || '-' || ppd.color_code || '.jpg'
    ELSE NULL::text END AS imagen_url,
  'TRÁNSITO_PP'::text AS origen_tipo,
  NULL::bigint AS deposito_id,
  NULL::bigint AS clasificacion_stock_id,
  NULL::text AS deposito_nombre,
  NULL::text AS clasificacion_stock_descp,
  col_j.tono_canon AS color_tono_canon,
  l.genero_id,
  gen.codigo AS genero_codigo,
  gen.descripcion AS descp_genero,
  'CALZADO'::text AS ramo_tipo
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

-- RPC meta sidebar — agregación SQL (sin scan 12k en Node)
CREATE OR REPLACE FUNCTION public.rimec_catalogo_meta(
  p_es_pe boolean DEFAULT false,
  p_marca_id bigint DEFAULT NULL,
  p_linea_ids bigint[] DEFAULT NULL,
  p_grupo_estilo_id bigint DEFAULT NULL,
  p_tipo_ids bigint[] DEFAULT NULL,
  p_genero_codigo text DEFAULT NULL,
  p_ramo_tipo text DEFAULT NULL,
  p_deposito text DEFAULT NULL,
  p_quincena_ids bigint[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_es_pe THEN
    SELECT jsonb_build_object(
      'marcas', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', marca_id, 'label', lbl) ORDER BY lbl)
        FROM (
          SELECT DISTINCT marca_id, btrim(descp_marca) AS lbl
          FROM v_stock_pe_rimec v
          WHERE cajas_disponibles > 0 AND btrim(descp_marca) <> ''
            AND (p_marca_id IS NULL OR marca_id = p_marca_id)
            AND (p_linea_ids IS NULL OR array_length(p_linea_ids, 1) IS NULL OR linea_id = ANY(p_linea_ids))
            AND (p_grupo_estilo_id IS NULL OR grupo_estilo_id = p_grupo_estilo_id)
            AND (p_tipo_ids IS NULL OR array_length(p_tipo_ids, 1) IS NULL OR tipo_1_id = ANY(p_tipo_ids))
            AND (p_genero_codigo IS NULL OR btrim(p_genero_codigo) = '' OR upper(genero_codigo) = upper(p_genero_codigo))
            AND (p_ramo_tipo IS NULL OR btrim(p_ramo_tipo) = '' OR ramo_tipo = p_ramo_tipo)
            AND (p_deposito IS NULL OR btrim(p_deposito) = '' OR deposito_nombre = p_deposito)
        ) s
      ), '[]'::jsonb),
      'lineas', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', linea_id, 'label', lbl) ORDER BY lbl)
        FROM (
          SELECT DISTINCT linea_id, btrim(linea_codigo) AS lbl
          FROM v_stock_pe_rimec v
          WHERE cajas_disponibles > 0 AND linea_id IS NOT NULL AND btrim(linea_codigo) <> ''
            AND (p_marca_id IS NULL OR marca_id = p_marca_id)
            AND (p_grupo_estilo_id IS NULL OR grupo_estilo_id = p_grupo_estilo_id)
            AND (p_tipo_ids IS NULL OR array_length(p_tipo_ids, 1) IS NULL OR tipo_1_id = ANY(p_tipo_ids))
            AND (p_genero_codigo IS NULL OR btrim(p_genero_codigo) = '' OR upper(genero_codigo) = upper(p_genero_codigo))
            AND (p_ramo_tipo IS NULL OR btrim(p_ramo_tipo) = '' OR ramo_tipo = p_ramo_tipo)
            AND (p_deposito IS NULL OR btrim(p_deposito) = '' OR deposito_nombre = p_deposito)
        ) s
      ), '[]'::jsonb),
      'estilos', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', grupo_estilo_id, 'label', lbl) ORDER BY lbl)
        FROM (
          SELECT DISTINCT grupo_estilo_id, btrim(descp_grupo_estilo) AS lbl
          FROM v_stock_pe_rimec v
          WHERE cajas_disponibles > 0 AND grupo_estilo_id IS NOT NULL AND btrim(descp_grupo_estilo) <> ''
            AND (p_marca_id IS NULL OR marca_id = p_marca_id)
            AND (p_linea_ids IS NULL OR array_length(p_linea_ids, 1) IS NULL OR linea_id = ANY(p_linea_ids))
            AND (p_genero_codigo IS NULL OR btrim(p_genero_codigo) = '' OR upper(genero_codigo) = upper(p_genero_codigo))
            AND (p_ramo_tipo IS NULL OR btrim(p_ramo_tipo) = '' OR ramo_tipo = p_ramo_tipo)
        ) s
      ), '[]'::jsonb),
      'tipos', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', tipo_1_id, 'label', lbl) ORDER BY lbl)
        FROM (
          SELECT DISTINCT tipo_1_id, btrim(descp_tipo_1) AS lbl
          FROM v_stock_pe_rimec v
          WHERE cajas_disponibles > 0 AND tipo_1_id IS NOT NULL AND btrim(descp_tipo_1) <> ''
            AND (p_marca_id IS NULL OR marca_id = p_marca_id)
            AND (p_linea_ids IS NULL OR array_length(p_linea_ids, 1) IS NULL OR linea_id = ANY(p_linea_ids))
            AND (p_genero_codigo IS NULL OR btrim(p_genero_codigo) = '' OR upper(genero_codigo) = upper(p_genero_codigo))
            AND (p_ramo_tipo IS NULL OR btrim(p_ramo_tipo) = '' OR ramo_tipo = p_ramo_tipo)
        ) s
      ), '[]'::jsonb),
      'generos', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('codigo', codigo, 'label', lbl) ORDER BY codigo)
        FROM (
          SELECT DISTINCT upper(btrim(genero_codigo)) AS codigo, btrim(descp_genero) AS lbl
          FROM v_stock_pe_rimec v
          WHERE cajas_disponibles > 0 AND btrim(genero_codigo) <> ''
            AND (p_marca_id IS NULL OR marca_id = p_marca_id)
            AND (p_ramo_tipo IS NULL OR btrim(p_ramo_tipo) = '' OR ramo_tipo = p_ramo_tipo)
        ) s
      ), '[]'::jsonb),
      'colores', COALESCE((
        SELECT jsonb_agg(lbl ORDER BY lbl)
        FROM (SELECT DISTINCT btrim(descp_color) AS lbl FROM v_stock_pe_rimec v
          WHERE cajas_disponibles > 0 AND btrim(descp_color) <> ''
            AND (p_marca_id IS NULL OR marca_id = p_marca_id)
            AND (p_linea_ids IS NULL OR array_length(p_linea_ids, 1) IS NULL OR linea_id = ANY(p_linea_ids))
        ) s
      ), '[]'::jsonb),
      'quincenas', '[]'::jsonb,
      'tonos', COALESCE((
        SELECT jsonb_agg(DISTINCT lbl ORDER BY lbl)
        FROM (
          SELECT btrim(color_tono_canon->>'etiqueta') AS lbl
          FROM v_stock_pe_rimec v
          WHERE cajas_disponibles > 0 AND color_tono_canon IS NOT NULL
            AND btrim(color_tono_canon->>'etiqueta') <> ''
            AND (p_marca_id IS NULL OR marca_id = p_marca_id)
            AND (p_linea_ids IS NULL OR array_length(p_linea_ids, 1) IS NULL OR linea_id = ANY(p_linea_ids))
        ) s WHERE lbl IS NOT NULL
      ), '[]'::jsonb)
    ) INTO v_result;
  ELSE
    SELECT jsonb_build_object(
      'marcas', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', marca_id, 'label', lbl) ORDER BY lbl)
        FROM (
          SELECT DISTINCT marca_id, btrim(descp_marca) AS lbl
          FROM v_stock_rimec v
          WHERE cajas_disponibles > 0 AND origen_tipo = 'TRÁNSITO_PP' AND btrim(descp_marca) <> ''
            AND (p_marca_id IS NULL OR marca_id = p_marca_id)
            AND (p_linea_ids IS NULL OR array_length(p_linea_ids, 1) IS NULL OR linea_id = ANY(p_linea_ids))
            AND (p_genero_codigo IS NULL OR btrim(p_genero_codigo) = '' OR upper(genero_codigo) = upper(p_genero_codigo))
        ) s
      ), '[]'::jsonb),
      'lineas', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', linea_id, 'label', lbl) ORDER BY lbl)
        FROM (
          SELECT DISTINCT linea_id, btrim(linea_codigo) AS lbl
          FROM v_stock_rimec v
          WHERE cajas_disponibles > 0 AND origen_tipo = 'TRÁNSITO_PP' AND linea_id IS NOT NULL
            AND (p_marca_id IS NULL OR marca_id = p_marca_id)
            AND (p_genero_codigo IS NULL OR btrim(p_genero_codigo) = '' OR upper(genero_codigo) = upper(p_genero_codigo))
        ) s
      ), '[]'::jsonb),
      'estilos', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', grupo_estilo_id, 'label', lbl) ORDER BY lbl)
        FROM (
          SELECT DISTINCT grupo_estilo_id, btrim(descp_grupo_estilo) AS lbl
          FROM v_stock_rimec v
          WHERE cajas_disponibles > 0 AND origen_tipo = 'TRÁNSITO_PP' AND grupo_estilo_id IS NOT NULL
            AND (p_marca_id IS NULL OR marca_id = p_marca_id)
            AND (p_linea_ids IS NULL OR array_length(p_linea_ids, 1) IS NULL OR linea_id = ANY(p_linea_ids))
        ) s
      ), '[]'::jsonb),
      'tipos', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', tipo_1_id, 'label', lbl) ORDER BY lbl)
        FROM (
          SELECT DISTINCT tipo_1_id, btrim(descp_tipo_1) AS lbl
          FROM v_stock_rimec v
          WHERE cajas_disponibles > 0 AND origen_tipo = 'TRÁNSITO_PP' AND tipo_1_id IS NOT NULL
            AND (p_marca_id IS NULL OR marca_id = p_marca_id)
            AND (p_linea_ids IS NULL OR array_length(p_linea_ids, 1) IS NULL OR linea_id = ANY(p_linea_ids))
        ) s
      ), '[]'::jsonb),
      'generos', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('codigo', codigo, 'label', lbl) ORDER BY codigo)
        FROM (
          SELECT DISTINCT upper(btrim(genero_codigo)) AS codigo, btrim(descp_genero) AS lbl
          FROM v_stock_rimec v
          WHERE cajas_disponibles > 0 AND origen_tipo = 'TRÁNSITO_PP' AND btrim(genero_codigo) <> ''
        ) s
      ), '[]'::jsonb),
      'colores', COALESCE((
        SELECT jsonb_agg(lbl ORDER BY lbl)
        FROM (SELECT DISTINCT btrim(descp_color) AS lbl FROM v_stock_rimec v
          WHERE cajas_disponibles > 0 AND origen_tipo = 'TRÁNSITO_PP' AND btrim(descp_color) <> ''
            AND (p_marca_id IS NULL OR marca_id = p_marca_id)
        ) s
      ), '[]'::jsonb),
      'quincenas', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', quincena_arribo_id, 'label', lbl) ORDER BY quincena_arribo_id)
        FROM (
          SELECT DISTINCT quincena_arribo_id, btrim(quincena_desc) AS lbl
          FROM v_stock_rimec v
          WHERE cajas_disponibles > 0 AND origen_tipo = 'TRÁNSITO_PP' AND quincena_arribo_id IS NOT NULL
            AND (p_marca_id IS NULL OR marca_id = p_marca_id)
        ) s
      ), '[]'::jsonb),
      'tonos', COALESCE((
        SELECT jsonb_agg(DISTINCT lbl ORDER BY lbl)
        FROM (
          SELECT btrim(color_tono_canon->>'etiqueta') AS lbl
          FROM v_stock_rimec v
          WHERE cajas_disponibles > 0 AND origen_tipo = 'TRÁNSITO_PP' AND color_tono_canon IS NOT NULL
            AND btrim(color_tono_canon->>'etiqueta') <> ''
        ) s WHERE lbl IS NOT NULL
      ), '[]'::jsonb)
    ) INTO v_result;
  END IF;
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rimec_catalogo_meta TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.rimec_catalogo_meta IS
  'Meta sidebar catálogo RIMEC Web · CAT-LAT-T2 · agregación SQL';
