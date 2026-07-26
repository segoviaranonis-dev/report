-- MIG-167 · Logística OK — Pendiente de confirmación + bandera PP
-- Doc: .claude/2_modulos/2.3_report/logistica_ok/CHUSAR_LOGISTICA_OK_BD_INTEGRIDAD.md
-- Palabra reservada UI: "Fecha de entrega Real" → pedido_proveedor.fecha_arribo_real
-- NO tocar: registro_ventas_general_v2 · v_stock_rimec · pedido_proveedor_detalle (AM comercial)
-- Futuro: logistica_entrega_geo (mapa) — fase 2

BEGIN;

-- ── PP: bandera logística (Fecha de entrega Real = fecha_arribo_real · MIG-097) ──

ALTER TABLE public.pedido_proveedor
  ADD COLUMN IF NOT EXISTS logistica_bandera_activa BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS logistica_activada_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS logistica_activada_por INTEGER REFERENCES public.usuario_v2(id_usuario);

COMMENT ON COLUMN public.pedido_proveedor.fecha_arribo_real IS
  'Palabra reservada UI: Fecha de entrega Real. Orden bandeja Logística OK. Disparador sync FI.';

COMMENT ON COLUMN public.pedido_proveedor.logistica_bandera_activa IS
  'Bandera encendida al activar logística desde PP. FI CONFIRMADA entra en logistica_pendiente_confirmacion.';

-- ── Tabla puente: 1 fila por factura_interna ──

CREATE TABLE IF NOT EXISTS public.logistica_pendiente_confirmacion (
  id                      BIGSERIAL PRIMARY KEY,
  factura_interna_id      INTEGER NOT NULL UNIQUE
    REFERENCES public.factura_interna(id) ON DELETE CASCADE,
  pedido_proveedor_id     INTEGER NOT NULL
    REFERENCES public.pedido_proveedor(id) ON DELETE CASCADE,
  entidad_am              TEXT NOT NULL
    CHECK (entidad_am IN ('CP', 'PE', 'PROGRAMADO')),
  fecha_orden             DATE NOT NULL,
  id_cliente              INTEGER NOT NULL
    REFERENCES public.cliente_v2(id_cliente),
  id_cadena               INTEGER
    REFERENCES public.cadena_v2(id_cadena),
  id_vendedor             INTEGER,
  pares                   INTEGER NOT NULL DEFAULT 0,
  monto_neto              NUMERIC(18, 2),
  nro_factura             TEXT,
  fecha_entrega_vendedor  DATE,
  estado                  TEXT NOT NULL DEFAULT 'PENDIENTE'
    CHECK (estado IN ('PENDIENTE', 'CONFIRMADA')),
  confirmado_at           TIMESTAMPTZ,
  confirmado_por          INTEGER REFERENCES public.usuario_v2(id_usuario),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.logistica_pendiente_confirmacion IS
  'Logística OK · Pendiente de confirmación · 1:1 factura_interna. Sync desde PP con bandera ON.';

CREATE INDEX IF NOT EXISTS idx_logistica_pend_estado_fecha
  ON public.logistica_pendiente_confirmacion (estado, fecha_orden);

CREATE INDEX IF NOT EXISTS idx_logistica_pend_cadena_cliente
  ON public.logistica_pendiente_confirmacion (id_cadena, id_cliente);

CREATE INDEX IF NOT EXISTS idx_logistica_pend_vendedor
  ON public.logistica_pendiente_confirmacion (id_vendedor, estado)
  WHERE estado = 'PENDIENTE';

CREATE INDEX IF NOT EXISTS idx_logistica_pend_entidad_fecha
  ON public.logistica_pendiente_confirmacion (entidad_am, fecha_orden);

-- ── Resolver entidad AM (CP / PE / PROGRAMADO) ──

CREATE OR REPLACE FUNCTION public.logistica_ok_resolver_entidad_am(p_pp_id INTEGER)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.pedido_proveedor pp
      JOIN public.quincena_arribo qa ON qa.id = pp.quincena_arribo_id
      WHERE pp.id = p_pp_id
        AND lower(trim(qa.descripcion)) = lower('Pronta entrega')
    ) THEN 'PE'
    WHEN COALESCE(
      (SELECT pp.categoria_id FROM public.pedido_proveedor pp WHERE pp.id = p_pp_id),
      (SELECT ic.categoria_id
       FROM public.intencion_compra_pedido icp
       JOIN public.intencion_compra ic ON ic.id = icp.intencion_compra_id
       WHERE icp.pedido_proveedor_id = p_pp_id
       LIMIT 1)
    ) = 3 THEN 'PROGRAMADO'
    ELSE 'CP'
  END;
$$;

COMMIT;

-- POST-VERIFICACIÓN (manual):
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'logistica_pendiente_confirmacion';
-- SELECT logistica_ok_resolver_entidad_am(37);
