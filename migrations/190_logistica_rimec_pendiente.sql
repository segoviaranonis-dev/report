-- MIG-190 · Logística Rimec — bandeja cabeceras TXT Carlos (sin FI Nexus)
-- Etapa: LOGISTICA-RIMEC-TXT-20260728 · 2.3.1.28.10
-- NO tocar: logistica_pendiente_confirmacion (Logística de Proceso) · Sales Report

BEGIN;

CREATE TABLE IF NOT EXISTS public.logistica_rimec_lote (
  id              BIGSERIAL PRIMARY KEY,
  archivo_nombre  TEXT NOT NULL,
  periodo_label   TEXT,
  n_facturas      INTEGER NOT NULL DEFAULT 0,
  n_articulos     INTEGER NOT NULL DEFAULT 0,
  monto_total     NUMERIC(18, 2) NOT NULL DEFAULT 0,
  pares_total     INTEGER NOT NULL DEFAULT 0,
  importado_por   INTEGER REFERENCES public.usuario_v2(id_usuario),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.logistica_rimec_lote IS
  'Logística Rimec · lote de import TXT informe ventas Carlos.';

CREATE TABLE IF NOT EXISTS public.logistica_rimec_pendiente (
  id                      BIGSERIAL PRIMARY KEY,
  lote_id                 BIGINT NOT NULL
    REFERENCES public.logistica_rimec_lote(id) ON DELETE CASCADE,
  factura_carlos          TEXT NOT NULL,
  fecha_factura           DATE NOT NULL,
  codigo_cliente_carlos   INTEGER NOT NULL,
  id_cliente              INTEGER REFERENCES public.cliente_v2(id_cliente),
  codigo_vendedor_carlos  INTEGER NOT NULL,
  id_vendedor             INTEGER,
  lista_precio            TEXT,
  ped_pv                  TEXT,
  ped_cli                 TEXT,
  pares                   INTEGER NOT NULL DEFAULT 0,
  monto_neto              NUMERIC(18, 2) NOT NULL DEFAULT 0,
  n_articulos             INTEGER NOT NULL DEFAULT 0,
  origen                  TEXT NOT NULL DEFAULT 'TXT_INFORME_VENTAS',
  estado                  TEXT NOT NULL DEFAULT 'PENDIENTE'
    CHECK (estado IN ('PENDIENTE', 'CONFIRMADA', 'EN_ENTREGA', 'EXITOSA')),
  fecha_entrega_vendedor  DATE,
  pendiente_impresion_legal BOOLEAN NOT NULL DEFAULT true,
  impresion_legal_ok      BOOLEAN NOT NULL DEFAULT false,
  pendiente_entrega       BOOLEAN NOT NULL DEFAULT true,
  entregado_ok            BOOLEAN NOT NULL DEFAULT false,
  fecha_entrega_efectiva  DATE,
  chofer_nombre           TEXT,
  confirmado_at           TIMESTAMPTZ,
  confirmado_por          INTEGER REFERENCES public.usuario_v2(id_usuario),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (factura_carlos)
);

COMMENT ON TABLE public.logistica_rimec_pendiente IS
  'Logística Rimec · 1 fila por factura Carlos (TXT). Aislada de Logística de Proceso.';

CREATE INDEX IF NOT EXISTS idx_logistica_rimec_estado_fecha
  ON public.logistica_rimec_pendiente (estado, fecha_factura);

CREATE INDEX IF NOT EXISTS idx_logistica_rimec_cliente
  ON public.logistica_rimec_pendiente (codigo_cliente_carlos, estado);

CREATE INDEX IF NOT EXISTS idx_logistica_rimec_vendedor
  ON public.logistica_rimec_pendiente (codigo_vendedor_carlos, estado);

CREATE TABLE IF NOT EXISTS public.logistica_rimec_detalle (
  id              BIGSERIAL PRIMARY KEY,
  pendiente_id    BIGINT NOT NULL
    REFERENCES public.logistica_rimec_pendiente(id) ON DELETE CASCADE,
  articulo        TEXT NOT NULL,
  descripcion     TEXT,
  cant_vend       INTEGER NOT NULL DEFAULT 0,
  p_venta_gs      NUMERIC(18, 2) NOT NULL DEFAULT 0,
  t_venta_gs      NUMERIC(18, 2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_logistica_rimec_det_pend
  ON public.logistica_rimec_detalle (pendiente_id);

COMMIT;
