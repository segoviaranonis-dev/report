-- 189 · deep_link en notificaciones + INSERT service_role (alertas aprobación Web)

ALTER TABLE public.notificaciones
  ADD COLUMN IF NOT EXISTS deep_link TEXT;

COMMENT ON COLUMN public.notificaciones.deep_link IS 'Ruta Report relativa ej. /aprobaciones — modal crítico Ingresar';

GRANT INSERT ON public.notificaciones TO service_role;
