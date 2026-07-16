-- MIG-165 · Alejandro Magno — grada abierta 638 vs caja cerrada 654
-- Doc: report/docs/GRADA_ABIERTA_638_ALEJANDRO_MAGNO.md

ALTER TABLE public.pedido_proveedor_detalle
  ADD COLUMN IF NOT EXISTS am_modo_venta text
    CHECK (am_modo_venta IS NULL OR am_modo_venta IN ('UNIDAD', 'CAJA_CERRADA')),
  ADD COLUMN IF NOT EXISTS am_talle text,
  ADD COLUMN IF NOT EXISTS am_unidad_venta smallint;

COMMENT ON COLUMN public.pedido_proveedor_detalle.am_modo_venta IS
  '638=UNIDAD (prenda suelta) · 654=CAJA_CERRADA (curva importadora)';
COMMENT ON COLUMN public.pedido_proveedor_detalle.am_talle IS
  'Kyly 638 · talle normalizado desde DESCRIPCION GRADA (1, P, 4/6/8…)';
COMMENT ON COLUMN public.pedido_proveedor_detalle.am_unidad_venta IS
  '638 · unidades por click venta — paréntesis Carlos (1)';
