-- MIG-183 · Factura Real Carlos (número legal ERP · ej. 10019125327)
-- pv_global (int) queda para legacy PV000147; factura_carlos = texto canónico Excel Carlos col. FACTURA

ALTER TABLE public.factura_interna
  ADD COLUMN IF NOT EXISTS factura_carlos TEXT;

COMMENT ON COLUMN public.factura_interna.factura_carlos IS
  'Número factura legal sistema Carlos (Excel FACTURA). Palabra reservada UI: Factura Real.';

CREATE INDEX IF NOT EXISTS idx_fi_factura_carlos
  ON public.factura_interna (factura_carlos)
  WHERE factura_carlos IS NOT NULL AND BTRIM(factura_carlos) <> '';
