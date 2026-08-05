-- MIG-174: ventana token VALIDAR carrito 60s → 30 min (pedidos PE / logística).
-- Paridad app: rimec-web lib/carritoValidarPe.ts · store/sesionVenta.ts · carrito/page.tsx
-- confirmar route: revalida en servidor si el token del cliente ya venció.

BEGIN;

CREATE OR REPLACE FUNCTION public.carrito_token_vigente(
  p_id_usuario bigint,
  p_token uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.carrito_sesion
    WHERE id_usuario = p_id_usuario
      AND validacion_estado = 'OK'
      AND validacion_token  = p_token
      AND validada_en > now() - interval '30 minutes'
  );
$$;

COMMENT ON FUNCTION public.carrito_token_vigente(bigint, uuid) IS
  'Token VALIDAR vigente 30 minutos. MIG-081 60s; MIG-174 2026-08-02.';

COMMIT;

SELECT 'MIG-174 OK: carrito_token_vigente 30 minutes' AS estado;
