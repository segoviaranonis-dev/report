-- MIG-141 — Retirar vista puente v_stock_pe_rimec (PE vive en PPD · MIG-140)
-- v_stock_rimec permanece CP-only (MIG-138) — RIMEC Web no expone PE hasta validación local.
-- Report lee pedido_proveedor_detalle + discriminadores quincena / entidad_comercial.

DROP VIEW IF EXISTS public.v_stock_pe_rimec CASCADE;

COMMENT ON VIEW public.v_stock_rimec IS
  'Catálogo RIMEC Web CP/PREVENTA · TRÁNSITO_PP · estado_transito=EN_TRANSITO · categoria_id=2 · MIG-138/141 · PE en PPD no UNION';
