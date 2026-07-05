-- MIG-135 — columna sistema legal en stock pronta entrega (CSV factura)
-- Guarda nombre columna POS: S00_D1 | S00_DEP2 | S00_D3

ALTER TABLE public.stock_pronta_entrega_rimec
  ADD COLUMN IF NOT EXISTS columna_stock_legal text;

UPDATE public.stock_pronta_entrega_rimec
SET columna_stock_legal = CASE deposito_codigo
  WHEN 'D1' THEN 'S00_D1'
  WHEN 'DEP2' THEN 'S00_DEP2'
  WHEN 'D3' THEN 'S00_D3'
  ELSE deposito_codigo
END
WHERE columna_stock_legal IS NULL;

COMMENT ON COLUMN public.stock_pronta_entrega_rimec.columna_stock_legal IS
  'Nombre columna sistema legal (sdrm CSV). Obligatorio en export factura.';
