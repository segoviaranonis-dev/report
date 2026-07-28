-- MIG-191 · Logística Rimec — entidad AM + pilares detalle (Excel Carlos)
BEGIN;

ALTER TABLE public.logistica_rimec_pendiente
  ADD COLUMN IF NOT EXISTS entidad_am TEXT NOT NULL DEFAULT 'CP',
  ADD COLUMN IF NOT EXISTS nro_pedido_externo TEXT,
  ADD COLUMN IF NOT EXISTS observacion TEXT,
  ADD COLUMN IF NOT EXISTS factura_interna_id INTEGER;

ALTER TABLE public.logistica_rimec_pendiente
  DROP CONSTRAINT IF EXISTS logistica_rimec_pendiente_entidad_am_check;

ALTER TABLE public.logistica_rimec_pendiente
  ADD CONSTRAINT logistica_rimec_pendiente_entidad_am_check
  CHECK (entidad_am IN ('CP', 'PE', 'PROGRAMADO'));

CREATE INDEX IF NOT EXISTS idx_logistica_rimec_entidad_estado
  ON public.logistica_rimec_pendiente (entidad_am, estado);

ALTER TABLE public.logistica_rimec_detalle
  ADD COLUMN IF NOT EXISTS linea_ref TEXT,
  ADD COLUMN IF NOT EXISTS material_code TEXT,
  ADD COLUMN IF NOT EXISTS color_code TEXT,
  ADD COLUMN IF NOT EXISTS grada TEXT,
  ADD COLUMN IF NOT EXISTS monto_unitario NUMERIC(18, 2);

COMMIT;
