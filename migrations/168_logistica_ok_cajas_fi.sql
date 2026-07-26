-- MIG-168 · Logística OK — cajas desde factura_interna_detalle (no pares)
BEGIN;

ALTER TABLE public.logistica_pendiente_confirmacion
  ADD COLUMN IF NOT EXISTS cajas INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.logistica_pendiente_confirmacion.cajas IS
  'Snapshot SUM(factura_interna_detalle.cajas) · unidad logística canónica';

UPDATE public.logistica_pendiente_confirmacion l
SET cajas = COALESCE((
  SELECT SUM(fid.cajas)::int
  FROM public.factura_interna_detalle fid
  WHERE fid.factura_id = l.factura_interna_id
), 0)
WHERE l.cajas = 0 OR l.cajas IS NULL;

COMMIT;
