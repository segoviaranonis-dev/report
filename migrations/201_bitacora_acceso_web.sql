-- MIG-201: Bitácora monitoreo — login web + eventos venta activa
-- Etapa: BITACORA-MONITOREO-SESION-VENTA-20260807 · CHUSAR 2.3.1.51
-- Apps: Report /holding/bitacora · rimec-web login + carrito/sesion

BEGIN;

CREATE TABLE IF NOT EXISTS public.bitacora_acceso_web (
  id              bigserial PRIMARY KEY,
  id_usuario      integer NOT NULL REFERENCES public.usuario_v2 (id_usuario),
  app             text NOT NULL DEFAULT 'rimec-web',
  evento          text NOT NULL,
  detalle         jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bitacora_acceso_web_evento_chk CHECK (
    evento IN ('LOGIN', 'LOGOUT', 'VENTA_ACTIVA', 'VENTA_CERRADA')
  )
);

CREATE INDEX IF NOT EXISTS idx_bitacora_acceso_web_usuario_created
  ON public.bitacora_acceso_web (id_usuario, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bitacora_acceso_web_evento_created
  ON public.bitacora_acceso_web (evento, created_at DESC);

COMMENT ON TABLE public.bitacora_acceso_web IS
  'Monitoreo holding: inicio de sesión y venta activa (Bitácora fase 1 · MIG-201).';

COMMIT;

SELECT 'MIG-201 OK: bitacora_acceso_web' AS estado;
