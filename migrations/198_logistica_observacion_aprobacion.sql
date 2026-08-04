-- MIG-198 — Obs. Logística · origen APROBACION (comentarios Nivel Dios en Aprobaciones)
-- Doc: CHUSAR aprobaciones obs PE · 2026-08-04

BEGIN;

ALTER TABLE public.logistica_observacion
  DROP CONSTRAINT IF EXISTS logistica_observacion_origen_check;

ALTER TABLE public.logistica_observacion
  ADD CONSTRAINT logistica_observacion_origen_check
  CHECK (origen IN ('IC', 'PP', 'PE_WEB', 'APROBACION'));

COMMENT ON COLUMN public.logistica_observacion.origen IS
  'IC|PP|PE_WEB|APROBACION — hilo Obs. Logística + notas admin Aprobaciones.';

COMMIT;

SELECT 'MIG-198 OK: logistica_observacion origen APROBACION' AS estado;
