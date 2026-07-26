-- MIG-177 — CP precios: vincular determinístico + sync + certificación integridad Web/FI
-- Unidad de dirección = PPD vinculado · Web v_stock_rimec solo PPD (MIG-176)

BEGIN;

-- ── Helper: precio_lista canónico (MIN id por molécula) ─────────────────────
CREATE OR REPLACE FUNCTION public._pl_canonico_cp(
  p_evento_id bigint,
  p_linea_id bigint,
  p_referencia_id bigint,
  p_material_id bigint
)
RETURNS TABLE(
  lpn numeric,
  lpc02 numeric,
  lpc03 numeric,
  lpc04 numeric,
  dolar_aplicado numeric,
  nombre_caso_aplicado text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT pl.lpn, pl.lpc02, pl.lpc03, pl.lpc04, pl.dolar_aplicado, pl.nombre_caso_aplicado
  FROM public.precio_lista pl
  WHERE pl.evento_id = p_evento_id
    AND pl.linea_id = p_linea_id
    AND pl.referencia_id = p_referencia_id
    AND pl.material_id = p_material_id
    AND pl.lpn IS NOT NULL
  ORDER BY pl.id
  LIMIT 1;
$$;

-- ── Certificación integridad (PP o todos CP EN_TRANSITO) ────────────────────
CREATE OR REPLACE FUNCTION public.certificar_precios_cp_rimec(p_pp_id bigint DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $function$
DECLARE
  v_g1 int := 0;
  v_g2 int := 0;
  v_g3 int := 0;
  v_g4 int := 0;
  v_g5 int := 0;
  v_view_ok boolean := false;
  v_pp_ids bigint[];
BEGIN
  SELECT COALESCE(
    array_agg(pp.id ORDER BY pp.id),
    ARRAY[]::bigint[]
  )
  INTO v_pp_ids
  FROM public.pedido_proveedor pp
  WHERE pp.estado_transito = 'EN_TRANSITO'
    AND COALESCE(pp.categoria_id, (
      SELECT ic.categoria_id FROM public.intencion_compra_pedido icp
      JOIN public.intencion_compra ic ON ic.id = icp.intencion_compra_id
      WHERE icp.pedido_proveedor_id = pp.id ORDER BY icp.id LIMIT 1
    )) = 2
    AND (p_pp_id IS NULL OR pp.id = p_pp_id);

  -- G1: catálogo Web sin LPN en PPD
  SELECT COUNT(*)::int INTO v_g1
  FROM public.pedido_proveedor_detalle ppd
  JOIN public.pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
  WHERE pp.id = ANY(v_pp_ids)
    AND ppd.referencia IS NOT NULL
    AND GREATEST(0, COALESCE(ppd.cantidad_pares, 0) - COALESCE(ppd.pares_vendidos, 0)) > 0
    AND COALESCE(ppd.precio_lpn, 0) <= 0;

  -- G2: v_stock_rimec.lpn ≠ PPD.precio_lpn
  SELECT COUNT(*)::int INTO v_g2
  FROM public.v_stock_rimec v
  JOIN public.pedido_proveedor_detalle ppd ON ppd.id = v.det_id
  WHERE v.pp_id = ANY(v_pp_ids)
    AND ppd.precio_lpn IS DISTINCT FROM v.lpn;

  -- G3: PPD ≠ listado canónico ICP
  SELECT COUNT(*)::int INTO v_g3
  FROM public.pedido_proveedor_detalle ppd
  JOIN public.pedido_proveedor p ON p.id = ppd.pedido_proveedor_id
  JOIN public.intencion_compra_pedido icp ON icp.pedido_proveedor_id = p.id AND icp.precio_evento_id IS NOT NULL
  LEFT JOIN public.linea l
    ON l.codigo_proveedor::text = TRIM(ppd.linea) AND l.proveedor_id = p.proveedor_importacion_id
  LEFT JOIN public.material m
    ON m.codigo_proveedor::text = TRIM(ppd.material_code) AND m.proveedor_id = p.proveedor_importacion_id
  LEFT JOIN public.referencia ref
    ON ref.codigo_proveedor::text = TRIM(ppd.referencia) AND ref.linea_id = l.id
  LEFT JOIN LATERAL public._pl_canonico_cp(icp.precio_evento_id, l.id, ref.id, m.id) pc ON true
  WHERE p.id = ANY(v_pp_ids)
    AND icp.id = (SELECT icp2.id FROM public.intencion_compra_pedido icp2
                  WHERE icp2.pedido_proveedor_id = p.id AND icp2.precio_evento_id IS NOT NULL
                  ORDER BY icp2.id LIMIT 1)
    AND pc.lpn IS NOT NULL
    AND ppd.precio_lpn IS DISTINCT FROM pc.lpn;

  -- G4: FI precio_unit no coincide con ningún tier PPD vinculado
  SELECT COUNT(*)::int INTO v_g4
  FROM public.factura_interna fi
  JOIN public.factura_interna_detalle fid ON fid.factura_id = fi.id
  JOIN public.pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
  WHERE fi.pp_id = ANY(v_pp_ids)
    AND UPPER(TRIM(fi.estado)) IN ('RESERVADA', 'CONFIRMADA')
    AND COALESCE(ppd.precio_lpn, 0) > 0
    AND fid.precio_unit IS NOT NULL
    AND fid.precio_unit NOT IN (
      ppd.precio_lpn,
      COALESCE(ppd.precio_lpc02, ppd.precio_lpn),
      COALESCE(ppd.precio_lpc03, ppd.precio_lpn),
      COALESCE(ppd.precio_lpc04, ppd.precio_lpn)
    );

  -- G5: carrito item snapshot ≠ v_stock LPN vinculado
  SELECT COUNT(*)::int INTO v_g5
  FROM public.carrito_item ci
  JOIN public.v_stock_rimec v ON v.det_id = ci.det_id
  WHERE v.pp_id = ANY(v_pp_ids)
    AND COALESCE(v.lpn, 0) > 0
    AND ci.precio_snapshot IS DISTINCT FROM v.lpn;

  SELECT NOT (pg_get_viewdef('public.v_stock_rimec'::regclass, true) ~ 'pl\.lpn')
  INTO v_view_ok;

  RETURN jsonb_build_object(
    'ok', (v_g1 + v_g2 + v_g4 + v_g5 = 0 AND v_view_ok),
    'listado_drift', v_g3,
    'ts', NOW(),
    'pp_ids', v_pp_ids,
    'gates', jsonb_build_object(
      'G1_ppd_sin_lpn', v_g1,
      'G2_web_vs_ppd', v_g2,
      'G3_ppd_vs_listado_canon', v_g3,
      'G4_fi_vs_ppd', v_g4,
      'G5_carrito_vs_web', v_g5,
      'G6_vista_solo_ppd', v_view_ok
    )
  );
END;
$function$;

-- ── Sync PPD desde listado ICP (rescue EN_TRANSITO, sin gate ABIERTO) ───────
CREATE OR REPLACE FUNCTION public.sincronizar_precios_vinculados_cp(p_pp_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_evento bigint;
  v_n bigint;
  v_cert jsonb;
BEGIN
  SELECT icp.precio_evento_id INTO v_evento
  FROM public.intencion_compra_pedido icp
  WHERE icp.pedido_proveedor_id = p_pp_id AND icp.precio_evento_id IS NOT NULL
  ORDER BY icp.id LIMIT 1;

  IF v_evento IS NULL THEN
    RETURN jsonb_build_object('success', false, 'detail', 'SIN_EVENTO_ICP');
  END IF;

  WITH src AS (
    SELECT DISTINCT ON (ppd.id)
      ppd.id AS det_id,
      pc.lpn, pc.lpc02, pc.lpc03, pc.lpc04, pc.dolar_aplicado, pc.nombre_caso_aplicado,
      (SELECT cpb.id FROM public.caso_precio_biblioteca cpb
       WHERE cpb.nombre_caso = pc.nombre_caso_aplicado LIMIT 1) AS caso_bib_id
    FROM public.pedido_proveedor_detalle ppd
    JOIN public.pedido_proveedor p ON p.id = ppd.pedido_proveedor_id
    LEFT JOIN public.linea l
      ON l.codigo_proveedor::text = TRIM(ppd.linea) AND l.proveedor_id = p.proveedor_importacion_id
    LEFT JOIN public.material m
      ON m.codigo_proveedor::text = TRIM(ppd.material_code) AND m.proveedor_id = p.proveedor_importacion_id
    LEFT JOIN public.referencia ref
      ON ref.codigo_proveedor::text = TRIM(ppd.referencia) AND ref.linea_id = l.id
    LEFT JOIN LATERAL public._pl_canonico_cp(v_evento, l.id, ref.id, m.id) pc ON true
    WHERE ppd.pedido_proveedor_id = p_pp_id AND pc.lpn IS NOT NULL
    ORDER BY ppd.id
  )
  UPDATE public.pedido_proveedor_detalle ppd
  SET precio_lpn = src.lpn,
      precio_lpc02 = src.lpc02,
      precio_lpc03 = src.lpc03,
      precio_lpc04 = src.lpc04,
      precio_dolar_origen = src.dolar_aplicado,
      biblioteca_id = src.caso_bib_id,
      listado_precio_id = v_evento,
      descp_caso_snapshot = src.nombre_caso_aplicado,
      precio_vinculado_en = NOW()
  FROM src
  WHERE ppd.id = src.det_id;

  GET DIAGNOSTICS v_n = ROW_COUNT;

  PERFORM public.apply_ley_precios_rimec_web_ppd(p_pp_id);

  v_cert := public.certificar_precios_cp_rimec(p_pp_id);

  RETURN jsonb_build_object(
    'success', true,
    'pp_id', p_pp_id,
    'evento_id', v_evento,
    'filas_actualizadas', v_n,
    'certificacion', v_cert,
    'certificacion_ok', COALESCE((v_cert->>'ok')::boolean, false),
    'detail', 'SYNC_PPD_MIG177'
  );
END;
$function$;

-- ── vincular_listado_a_pp — join determinístico + ley LPC + cert ─────────────
CREATE OR REPLACE FUNCTION public.vincular_listado_a_pp(
  p_pp_id bigint,
  p_evento_id bigint DEFAULT NULL,
  p_usuario_id bigint DEFAULT NULL,
  p_incluir_vendidos boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_estado text;
  v_evento bigint;
  v_congeladas bigint := 0;
  v_paso1 bigint := 0;
  v_paso2 bigint := 0;
  v_sin_match bigint;
  v_cert jsonb;
BEGIN
  SELECT UPPER(TRIM(pp.estado))
  INTO v_estado
  FROM public.pedido_proveedor pp
  WHERE pp.id = p_pp_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'PP no existe', 'detail', 'PP_INEXISTENTE');
  END IF;

  IF v_estado IS DISTINCT FROM 'ABIERTO' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('PP en estado %s. Solo ABIERTO permite re-vincular snapshot.', v_estado),
      'detail', 'PP_NO_ABIERTO'
    );
  END IF;

  SELECT COUNT(*)
  INTO v_congeladas
  FROM public.pedido_proveedor_detalle ppd
  WHERE ppd.pedido_proveedor_id = p_pp_id
    AND GREATEST(0, COALESCE(ppd.cantidad_pares, 0) - COALESCE(ppd.pares_vendidos, 0)) = 0
    AND COALESCE(ppd.pares_vendidos, 0) > 0;

  v_evento := COALESCE(
    p_evento_id,
    (
      SELECT DISTINCT icp.precio_evento_id
      FROM public.intencion_compra_pedido icp
      WHERE icp.pedido_proveedor_id = p_pp_id
        AND icp.precio_evento_id IS NOT NULL
      ORDER BY icp.precio_evento_id
      LIMIT 1
    )
  );

  IF v_evento IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'El PP no tiene precio_evento_id en intencion_compra_pedido.',
      'detail', 'SIN_EVENTO_PRECIO'
    );
  END IF;

  WITH fuente AS (
    SELECT DISTINCT ON (ppd.id)
      ppd.id AS det_id,
      pc.lpn,
      pc.lpc02,
      pc.lpc03,
      pc.lpc04,
      pc.dolar_aplicado,
      (SELECT cpb.id FROM public.caso_precio_biblioteca cpb
        WHERE cpb.nombre_caso = pc.nombre_caso_aplicado LIMIT 1) AS caso_bib_id,
      pc.nombre_caso_aplicado
    FROM public.pedido_proveedor_detalle ppd
    JOIN public.pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
    LEFT JOIN public.material m
      ON m.codigo_proveedor::text = ppd.material_code
     AND m.proveedor_id = pp.proveedor_importacion_id
    LEFT JOIN public.linea l
      ON l.codigo_proveedor::text = ppd.linea
     AND l.proveedor_id = pp.proveedor_importacion_id
    LEFT JOIN public.referencia ref_j
      ON ref_j.codigo_proveedor::text = ppd.referencia
     AND ref_j.linea_id = l.id
    LEFT JOIN LATERAL public._pl_canonico_cp(
      v_evento, COALESCE(l.id, ref_j.linea_id), ref_j.id, m.id
    ) pc ON true
    WHERE pp.id = p_pp_id
      AND (
        p_incluir_vendidos
        OR GREATEST(0, COALESCE(ppd.cantidad_pares, 0) - COALESCE(ppd.pares_vendidos, 0)) > 0
      )
    ORDER BY ppd.id
  ),
  upd AS (
    UPDATE public.pedido_proveedor_detalle ppd
    SET
      precio_lpn           = f.lpn,
      precio_lpc02         = f.lpc02,
      precio_lpc03         = f.lpc03,
      precio_lpc04         = f.lpc04,
      precio_dolar_origen  = f.dolar_aplicado,
      biblioteca_id        = f.caso_bib_id,
      listado_precio_id    = v_evento,
      descp_caso_snapshot  = f.nombre_caso_aplicado,
      precio_vinculado_en  = now(),
      precio_vinculado_por = p_usuario_id
    FROM fuente f
    WHERE ppd.id = f.det_id
      AND f.lpn IS NOT NULL
    RETURNING ppd.id
  )
  SELECT COUNT(*) INTO v_paso1 FROM upd;

  WITH faltantes AS (
    SELECT
      ppd.id AS det_id,
      TRIM(ppd.linea)      AS cod_linea,
      TRIM(ppd.referencia) AS cod_ref,
      m.id                 AS material_id
    FROM public.pedido_proveedor_detalle ppd
    JOIN public.pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
    LEFT JOIN public.material m
      ON m.codigo_proveedor::text = ppd.material_code
     AND m.proveedor_id = pp.proveedor_importacion_id
    WHERE pp.id = p_pp_id
      AND ppd.precio_lpn IS NULL
      AND m.id IS NOT NULL
      AND (
        p_incluir_vendidos
        OR GREATEST(0, COALESCE(ppd.cantidad_pares, 0) - COALESCE(ppd.pares_vendidos, 0)) > 0
      )
  ),
  match_codigos AS (
    SELECT DISTINCT ON (f.det_id)
      f.det_id,
      pl.lpn,
      pl.lpc02,
      pl.lpc03,
      pl.lpc04,
      pl.dolar_aplicado,
      (SELECT cpb.id FROM public.caso_precio_biblioteca cpb
        WHERE cpb.nombre_caso = pl.nombre_caso_aplicado LIMIT 1) AS caso_bib_id,
      pl.nombre_caso_aplicado
    FROM faltantes f
    JOIN public.precio_lista pl
      ON pl.evento_id = v_evento
     AND TRIM(pl.linea_codigo)      = f.cod_linea
     AND TRIM(pl.referencia_codigo) = f.cod_ref
     AND pl.material_id = f.material_id
    WHERE pl.lpn IS NOT NULL
    ORDER BY f.det_id, pl.id
  ),
  upd2 AS (
    UPDATE public.pedido_proveedor_detalle ppd
    SET
      precio_lpn           = mc.lpn,
      precio_lpc02         = mc.lpc02,
      precio_lpc03         = mc.lpc03,
      precio_lpc04         = mc.lpc04,
      precio_dolar_origen  = mc.dolar_aplicado,
      biblioteca_id        = mc.caso_bib_id,
      listado_precio_id    = v_evento,
      descp_caso_snapshot  = mc.nombre_caso_aplicado,
      precio_vinculado_en  = now(),
      precio_vinculado_por = p_usuario_id
    FROM match_codigos mc
    WHERE ppd.id = mc.det_id
    RETURNING ppd.id
  )
  SELECT COUNT(*) INTO v_paso2 FROM upd2;

  SELECT COUNT(*)
  INTO v_sin_match
  FROM public.pedido_proveedor_detalle ppd
  WHERE ppd.pedido_proveedor_id = p_pp_id
    AND ppd.precio_lpn IS NULL
    AND (
      p_incluir_vendidos
      OR GREATEST(0, COALESCE(ppd.cantidad_pares, 0) - COALESCE(ppd.pares_vendidos, 0)) > 0
    );

  PERFORM public.apply_ley_precios_rimec_web_ppd(p_pp_id);

  v_cert := public.certificar_precios_cp_rimec(p_pp_id);

  RETURN jsonb_build_object(
    'success', true,
    'pp_id', p_pp_id,
    'evento_id', v_evento,
    'incluir_vendidos', p_incluir_vendidos,
    'filas_paso1_ids', v_paso1,
    'filas_paso2_codigos', v_paso2,
    'filas_sin_match', v_sin_match,
    'filas_congeladas_venta', CASE WHEN p_incluir_vendidos THEN 0 ELSE v_congeladas END,
    'filas_vendidas_forzadas', CASE WHEN p_incluir_vendidos THEN v_congeladas ELSE 0 END,
    'actualizados', v_paso1 + v_paso2,
    'certificacion', v_cert,
    'certificacion_ok', COALESCE((v_cert->>'ok')::boolean, false),
    'detail', CASE
      WHEN p_incluir_vendidos THEN 'SNAPSHOT_OK_MIG177_TODOS_INCL_VENDIDOS'
      ELSE 'SNAPSHOT_OK_MIG177_SOLO_TRANSITO'
    END
  );
END;
$function$;

COMMENT ON FUNCTION public.certificar_precios_cp_rimec(bigint) IS
  'MIG-177: 6 gates integridad CP — PPD, Web, listado, FI, carrito, vista solo PPD.';
COMMENT ON FUNCTION public.sincronizar_precios_vinculados_cp(bigint) IS
  'MIG-177: rescue sync PPD=listado canónico + ley LPC + cert (sin gate ABIERTO).';

COMMIT;

SELECT 'MIG-177 OK: certificación CP + vincular determinístico' AS estado;
