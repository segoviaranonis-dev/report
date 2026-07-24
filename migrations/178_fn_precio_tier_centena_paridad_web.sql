-- MIG-178 — fn_precio_tier_vista: centena próxima (paridad RIMEC Web · 2.3.1.7.1.0.2)
-- Hotfix prod 2026-07-24: det 563 lista 3 payload 127000 vs BD 127008

BEGIN;

CREATE OR REPLACE FUNCTION public.redondear_centena_gs(p_valor numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_valor IS NULL OR p_valor = 0 THEN 0::numeric
    ELSE ROUND(p_valor / 100) * 100
  END;
$$;

COMMENT ON FUNCTION public.redondear_centena_gs(numeric) IS
  'Centena Gs. más próxima · paridad redondearCentenaGs RIMEC Web.';

CREATE OR REPLACE FUNCTION public.fn_precio_tier_vista(
  p_lista integer,
  p_lpn numeric,
  p_lpc02 numeric,
  p_lpc03 numeric,
  p_lpc04 numeric,
  p_descp_caso text
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_lista
    WHEN 1 THEN public.redondear_centena_gs(p_lpn)
    WHEN 2 THEN public.redondear_centena_gs(p_lpc02)
    WHEN 3 THEN
      CASE
        WHEN UPPER(TRIM(COALESCE(p_descp_caso, ''))) = 'PROMOCIONAL' THEN
          public.redondear_centena_gs(p_lpn)
        WHEN COALESCE(p_lpn, 0) > 0 THEN
          public.redondear_centena_gs(p_lpn * 1.12)
        ELSE
          public.redondear_centena_gs(p_lpc03)
      END
    WHEN 4 THEN
      CASE
        WHEN UPPER(TRIM(COALESCE(p_descp_caso, ''))) = 'PROMOCIONAL' THEN
          public.redondear_centena_gs(p_lpn)
        WHEN COALESCE(p_lpn, 0) > 0 THEN
          public.redondear_centena_gs(p_lpn * 1.20)
        ELSE
          public.redondear_centena_gs(p_lpc04)
      END
    ELSE public.redondear_centena_gs(p_lpn)
  END;
$$;

COMMENT ON FUNCTION public.fn_precio_tier_vista(integer, numeric, numeric, numeric, numeric, text) IS
  'MIG-178: tier + centena próxima · paridad getPrecioActivo Web.';

CREATE OR REPLACE FUNCTION public.apply_ley_precios_rimec_web_ppd(
  p_pp_id bigint DEFAULT NULL
)
RETURNS TABLE(filas_actualizadas bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n_arith bigint := 0;
  n_promo bigint := 0;
BEGIN
  UPDATE public.pedido_proveedor_detalle ppd
  SET
    precio_lpc03 = public.redondear_centena_gs(ppd.precio_lpn * 1.12),
    precio_lpc04 = public.redondear_centena_gs(ppd.precio_lpn * 1.20)
  WHERE ppd.precio_lpn IS NOT NULL
    AND ppd.precio_lpn > 0
    AND (p_pp_id IS NULL OR ppd.pedido_proveedor_id = p_pp_id)
    AND UPPER(TRIM(COALESCE(ppd.descp_caso_snapshot, ''))) IS DISTINCT FROM 'PROMOCIONAL';

  GET DIAGNOSTICS n_arith = ROW_COUNT;

  UPDATE public.pedido_proveedor_detalle ppd
  SET
    precio_lpc03 = public.redondear_centena_gs(ppd.precio_lpn),
    precio_lpc04 = public.redondear_centena_gs(ppd.precio_lpn)
  WHERE ppd.precio_lpn IS NOT NULL
    AND ppd.precio_lpn > 0
    AND (p_pp_id IS NULL OR ppd.pedido_proveedor_id = p_pp_id)
    AND UPPER(TRIM(COALESCE(ppd.descp_caso_snapshot, ''))) = 'PROMOCIONAL';

  GET DIAGNOSTICS n_promo = ROW_COUNT;

  filas_actualizadas := n_arith + n_promo;
  RETURN NEXT;
END;
$$;

SELECT public.apply_ley_precios_rimec_web_ppd(NULL);

COMMIT;

SELECT 'MIG-178 OK: fn_precio_tier centena + apply_ley PPD' AS estado;
