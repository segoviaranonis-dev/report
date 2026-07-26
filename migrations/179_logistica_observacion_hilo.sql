-- MIG-179 — Obs. Logística · hilo con autor (IC → PP → PE Web → FI → Logística OK)
-- Doc: LOGISTICA-OK-20260719 · CHUSAR_LOGISTICA_OK_PLAN_OPERATIVO_PESTANAS_20260723

BEGIN;

CREATE TABLE IF NOT EXISTS public.logistica_observacion (
  id BIGSERIAL PRIMARY KEY,
  intencion_compra_id INT REFERENCES public.intencion_compra(id) ON DELETE SET NULL,
  pedido_proveedor_id INT REFERENCES public.pedido_proveedor(id) ON DELETE SET NULL,
  factura_interna_id INT REFERENCES public.factura_interna(id) ON DELETE CASCADE,
  origen TEXT NOT NULL CHECK (origen IN ('IC', 'PP', 'PE_WEB')),
  usuario_id INT,
  usuario_nombre TEXT NOT NULL,
  texto TEXT NOT NULL CHECK (char_length(btrim(texto)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_log_obs_fi ON public.logistica_observacion(factura_interna_id);
CREATE INDEX IF NOT EXISTS idx_log_obs_ic ON public.logistica_observacion(intencion_compra_id);
CREATE INDEX IF NOT EXISTS idx_log_obs_pp ON public.logistica_observacion(pedido_proveedor_id);
CREATE INDEX IF NOT EXISTS idx_log_obs_created ON public.logistica_observacion(created_at);

COMMENT ON TABLE public.logistica_observacion IS
  'MIG-179: hilo Obs. Logística con autor · viaja IC→FI→Logística OK.';

CREATE TABLE IF NOT EXISTS public.logistica_observacion_lectura (
  factura_interna_id INT NOT NULL REFERENCES public.factura_interna(id) ON DELETE CASCADE,
  usuario_id INT NOT NULL,
  pestana TEXT NOT NULL,
  ultimo_obs_id BIGINT REFERENCES public.logistica_observacion(id) ON DELETE SET NULL,
  leido_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (factura_interna_id, usuario_id, pestana)
);

COMMENT ON TABLE public.logistica_observacion_lectura IS
  'MIG-179: lectura de obs por usuario y pestaña Logística OK.';

COMMIT;

SELECT 'MIG-179 OK: logistica_observacion + lectura' AS estado;
