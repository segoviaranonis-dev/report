-- MIG-175 — PE ↔ Logística OK · observación + fecha_entrega_cliente (rimec-web carrito)
-- Doc: CHUSAR_LOGISTICA_OK_PLAN_OPERATIVO_PESTANAS_20260723.md (2.3.1.28.5)
-- Campos opcionales en venta PE; sugeridos en UI, no bloquean confirmar.

BEGIN;

ALTER TABLE public.carrito_sesion
  ADD COLUMN IF NOT EXISTS observacion TEXT,
  ADD COLUMN IF NOT EXISTS fecha_entrega_cliente DATE;

COMMENT ON COLUMN public.carrito_sesion.observacion IS
  'MIG-175: notas vendedor PE → Logística OK (opcional, sesión carrito).';
COMMENT ON COLUMN public.carrito_sesion.fecha_entrega_cliente IS
  'MIG-175: día que el cliente quiere recibir · opcional al confirmar venta PE.';

ALTER TABLE public.pedido_venta_rimec
  ADD COLUMN IF NOT EXISTS observacion TEXT,
  ADD COLUMN IF NOT EXISTS fecha_entrega_cliente DATE;

COMMENT ON COLUMN public.pedido_venta_rimec.fecha_entrega_cliente IS
  'MIG-175: capturada en rimec-web · copia a FI y logística pendiente.';

ALTER TABLE public.factura_interna
  ADD COLUMN IF NOT EXISTS observacion TEXT,
  ADD COLUMN IF NOT EXISTS fecha_entrega_cliente DATE;

COMMENT ON COLUMN public.factura_interna.fecha_entrega_cliente IS
  'MIG-175: fecha_entrega_cliente producto · alias lógico de logistica_pendiente.fecha_entrega_vendedor.';

ALTER TABLE public.logistica_pendiente_confirmacion
  ADD COLUMN IF NOT EXISTS observacion TEXT;

COMMENT ON COLUMN public.logistica_pendiente_confirmacion.observacion IS
  'MIG-175: snapshot observación FI al sync logística.';

COMMIT;

SELECT 'MIG-175 OK: observacion + fecha_entrega_cliente PE/logística' AS estado;
