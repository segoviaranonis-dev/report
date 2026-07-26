-- MIG-174 — Logística OK · flujo pestañas · fecha_entrega_cliente · banderas depto
-- Doc: CHUSAR_LOGISTICA_OK_PLAN_OPERATIVO_PESTANAS_20260723.md (2.3.1.28.5)
-- Lexicono: Fecha de llegada (PP) · fecha_entrega_cliente (= fecha_entrega_vendedor col)

BEGIN;

ALTER TABLE public.logistica_pendiente_confirmacion
  ADD COLUMN IF NOT EXISTS pendiente_impresion_legal BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS impresion_legal_ok BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pendiente_entrega BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS entregado_ok BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fecha_entrega_efectiva DATE,
  ADD COLUMN IF NOT EXISTS chofer_nombre TEXT;

COMMENT ON COLUMN public.logistica_pendiente_confirmacion.fecha_entrega_vendedor IS
  'Producto 2026-07-23: fecha_entrega_cliente (día que el cliente quiere recibir). Confirmación = asignar esta fecha.';

COMMENT ON COLUMN public.pedido_proveedor.fecha_arribo_real IS
  'UI 2026-07-23: Fecha de llegada (PP CP). Puerta al circuito logístico. Legacy: Fecha de entrega Real.';

-- Ampliar estados del embudo
ALTER TABLE public.logistica_pendiente_confirmacion
  DROP CONSTRAINT IF EXISTS logistica_pendiente_confirmacion_estado_check;

ALTER TABLE public.logistica_pendiente_confirmacion
  ADD CONSTRAINT logistica_pendiente_confirmacion_estado_check
  CHECK (estado IN ('PENDIENTE', 'CONFIRMADA', 'EN_ENTREGA', 'EXITOSA'));

-- Confirmadas históricas: ya tienen fecha → pendientes de impresión legal
UPDATE public.logistica_pendiente_confirmacion
SET pendiente_impresion_legal = true,
    impresion_legal_ok = false,
    pendiente_entrega = true,
    entregado_ok = false
WHERE estado = 'CONFIRMADA'
  AND fecha_entrega_vendedor IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_logistica_pend_estado_entrega_cli
  ON public.logistica_pendiente_confirmacion (estado, fecha_entrega_vendedor);

COMMIT;

SELECT 'MIG-174 OK: logistica banderas + estados EN_ENTREGA/EXITOSA' AS estado;
