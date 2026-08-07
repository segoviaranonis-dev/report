-- MIG-202: Bitácora — HEARTBEAT presencia + semana laboral
-- Etapa BITACORA-MONITOREO-SESION-VENTA-20260807

BEGIN;

ALTER TABLE public.bitacora_acceso_web
  DROP CONSTRAINT IF EXISTS bitacora_acceso_web_evento_chk;

ALTER TABLE public.bitacora_acceso_web
  ADD CONSTRAINT bitacora_acceso_web_evento_chk CHECK (
    evento IN ('LOGIN', 'LOGOUT', 'VENTA_ACTIVA', 'VENTA_CERRADA', 'HEARTBEAT')
  );

COMMENT ON TABLE public.bitacora_acceso_web IS
  'Monitoreo holding: LOGIN/HEARTBEAT (sesión) + VENTA_ACTIVA · MIG-201/202.';

COMMIT;

SELECT 'MIG-202 OK: HEARTBEAT en bitacora_acceso_web' AS estado;
