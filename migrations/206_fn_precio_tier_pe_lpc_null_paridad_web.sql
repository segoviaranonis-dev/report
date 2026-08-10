-- MIG-206 — fn_precio_tier_vista: PE con lpc03/lpc04 NULL → ley Web (LPN×factor)
-- Hotfix 2026-08-10 · Patricia · PE ppd 177089 lista 3 · payload 71500 vs BD 63800
-- Causa: fn devolvía NULL si lpc03 vacío; confirmar_pedido_web hacía COALESCE → LPN.
-- Web (resolverLpcTier / getPrecioActivoPe): null o pegado a LPN → ROUND(LPN×1.12).

BEGIN;

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
        WHEN COALESCE(p_lpc03, 0) > 0
          AND public.redondear_centena_gs(p_lpc03)
            IS DISTINCT FROM public.redondear_centena_gs(p_lpn) THEN
          public.redondear_centena_gs(p_lpc03)
        WHEN COALESCE(p_lpn, 0) > 0 THEN
          public.redondear_centena_gs(p_lpn * 1.12)
        ELSE
          public.redondear_centena_gs(p_lpc03)
      END
    WHEN 4 THEN
      CASE
        WHEN UPPER(TRIM(COALESCE(p_descp_caso, ''))) = 'PROMOCIONAL' THEN
          public.redondear_centena_gs(p_lpn)
        WHEN COALESCE(p_lpc04, 0) > 0
          AND public.redondear_centena_gs(p_lpc04)
            IS DISTINCT FROM public.redondear_centena_gs(p_lpn) THEN
          public.redondear_centena_gs(p_lpc04)
        WHEN COALESCE(p_lpn, 0) > 0 THEN
          public.redondear_centena_gs(p_lpn * 1.20)
        ELSE
          public.redondear_centena_gs(p_lpc04)
      END
    ELSE public.redondear_centena_gs(p_lpn)
  END;
$$;

COMMENT ON FUNCTION public.fn_precio_tier_vista(integer, numeric, numeric, numeric, numeric, text) IS
  'MIG-206: paridad getPrecioActivo/Pe · lpc null o =LPN → LPN×factor · PROMO=LPN.';

COMMIT;

-- Smoke PE 177089
SELECT public.fn_precio_tier_vista(3, 63800, NULL, NULL, NULL, 'PE · sdrm3901') AS expect_71500;
