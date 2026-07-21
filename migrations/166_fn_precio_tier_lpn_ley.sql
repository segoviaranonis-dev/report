-- MIG-166 — fn_precio_tier_vista: LPC03/LPC04 desde LPN×factor (paridad RIMEC Web)
-- Hotfix 2026-07-17 · confirmar det 1096 payload 112560 vs BD lpc03 112500
-- Ley: resolverLpc03 = ROUND(lpn * 1.12) · resolverLpc04 = ROUND(lpn * 1.20) · PROMO = LPN

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
    WHEN 1 THEN p_lpn
    WHEN 2 THEN p_lpc02
    WHEN 3 THEN
      CASE
        WHEN UPPER(TRIM(COALESCE(p_descp_caso, ''))) = 'PROMOCIONAL' THEN p_lpn
        WHEN COALESCE(p_lpn, 0) > 0 THEN ROUND(p_lpn * 1.12)::numeric
        ELSE p_lpc03
      END
    WHEN 4 THEN
      CASE
        WHEN UPPER(TRIM(COALESCE(p_descp_caso, ''))) = 'PROMOCIONAL' THEN p_lpn
        WHEN COALESCE(p_lpn, 0) > 0 THEN ROUND(p_lpn * 1.20)::numeric
        ELSE p_lpc04
      END
    ELSE p_lpn
  END;
$$;

COMMENT ON FUNCTION public.fn_precio_tier_vista(integer, numeric, numeric, numeric, numeric, text) IS
  'MIG-166: tier lista 3/4 = LPN×1.12/×1.20 salvo PROMOCIONAL (=LPN). Paridad getPrecioActivo Web.';

COMMIT;

SELECT 'MIG-166 OK: fn_precio_tier_vista LPN×factor' AS estado;
