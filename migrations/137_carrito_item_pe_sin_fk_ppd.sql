-- MIG-137 — carrito_item: permitir det_id sintético PE (>= 800000000)
-- Pronta entrega no tiene fila en pedido_proveedor_detalle (MIG-134).
-- Doc: report/migrations/136_confirmar_pedido_web_pronta_entrega.sql

ALTER TABLE public.carrito_item
  DROP CONSTRAINT IF EXISTS carrito_item_det_id_fkey;

ALTER TABLE public.carrito_item
  DROP CONSTRAINT IF EXISTS carrito_item_pp_id_fkey;

COMMENT ON COLUMN public.carrito_item.det_id IS
  'Tránsito: pedido_proveedor_detalle.id · PE: 800000000 + stock_pronta_entrega_rimec.id (MIG-134)';

COMMENT ON COLUMN public.carrito_item.pp_id IS
  'PP real (tránsito) o pp_id sintético negativo agrupador PE (rimec-web/lib/prontaEntregaVenta.ts)';
