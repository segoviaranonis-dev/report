-- Pares por PDF adjunto (bandeja PE) — botón muestra cantidad
ALTER TABLE public.mensaje_interno_adjunto
  ADD COLUMN IF NOT EXISTS total_pares bigint NULL;

COMMENT ON COLUMN public.mensaje_interno_adjunto.total_pares IS
  'Stock PE pares del PDF · UI bandeja';
