-- MIG-184 · Factura Carlos manual PP — integridad BD
-- Complementa MIG-183 factura_carlos (texto legal ERP · ej. 10019125327)

-- Normalizar existentes: solo dígitos
UPDATE public.factura_interna
SET factura_carlos = NULLIF(BTRIM(regexp_replace(factura_carlos, '\D', '', 'g')), '')
WHERE factura_carlos IS NOT NULL
  AND BTRIM(factura_carlos) <> ''
  AND factura_carlos <> regexp_replace(factura_carlos, '\D', '', 'g');

ALTER TABLE public.factura_interna
  DROP CONSTRAINT IF EXISTS chk_fi_factura_carlos_digits;

ALTER TABLE public.factura_interna
  ADD CONSTRAINT chk_fi_factura_carlos_digits
  CHECK (
    factura_carlos IS NULL
    OR (
      BTRIM(factura_carlos) <> ''
      AND factura_carlos ~ '^\d{6,15}$'
    )
  );

COMMENT ON CONSTRAINT chk_fi_factura_carlos_digits ON public.factura_interna IS
  'Factura Carlos: 6–15 dígitos (Excel FACTURA · sistema ERP legacy).';

-- Sin duplicar mismo número Carlos en el mismo PP
DROP INDEX IF EXISTS uq_fi_pp_factura_carlos;
CREATE UNIQUE INDEX uq_fi_pp_factura_carlos
  ON public.factura_interna (pp_id, factura_carlos)
  WHERE factura_carlos IS NOT NULL AND BTRIM(factura_carlos) <> '';

-- Sin duplicar número Carlos global (cross-PP)
DROP INDEX IF EXISTS uq_fi_factura_carlos_global;
CREATE UNIQUE INDEX uq_fi_factura_carlos_global
  ON public.factura_interna (factura_carlos)
  WHERE factura_carlos IS NOT NULL AND BTRIM(factura_carlos) <> '';

-- Marca temporal manual (procedimiento batch futuro)
ALTER TABLE public.factura_interna
  ADD COLUMN IF NOT EXISTS factura_carlos_at TIMESTAMPTZ;

COMMENT ON COLUMN public.factura_interna.factura_carlos_at IS
  'Timestamp última asignación manual o import Factura Carlos.';
