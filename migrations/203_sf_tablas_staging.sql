-- MIG-203: Situación financiera — staging T01–T12 + variaciones
-- CHUSAR 2.3.1.50.4 · Etapa SITUACION-FINANCIERA-RIMEC-20260806
-- LAB only hasta cierre etapa / orden Director. NO tocar registro_ventas_general_v2.
-- T13/T14 (cobros) = fase 2 — no incluidas aquí.

BEGIN;

-- T03 catálogo tipos (antes de archivos que lo referencian por código texto)
CREATE TABLE IF NOT EXISTS public.sf_tipo_reporte (
  codigo            text PRIMARY KEY,
  descripcion       text NOT NULL DEFAULT '',
  parser_version    integer NOT NULL DEFAULT 1,
  columnas_esperadas jsonb NOT NULL DEFAULT '[]'::jsonb,
  activo            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sf_tipo_reporte IS 'T03 · tipos canónicos TXT ERP SF';

-- T01 corte
CREATE TABLE IF NOT EXISTS public.sf_corte (
  id                bigserial PRIMARY KEY,
  batch_id          uuid NOT NULL DEFAULT gen_random_uuid(),
  fecha_al          date NOT NULL,
  tasa_usd          numeric(18, 6),
  carpeta           text,
  estado            text NOT NULL DEFAULT 'borrador',
  meta              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  closed_at         timestamptz,
  CONSTRAINT sf_corte_estado_chk CHECK (
    estado IN ('borrador', 'variaciones_pendientes', 'cerrado')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sf_corte_batch_id ON public.sf_corte (batch_id);
CREATE INDEX IF NOT EXISTS idx_sf_corte_fecha_al ON public.sf_corte (fecha_al DESC);

COMMENT ON TABLE public.sf_corte IS 'T01 · cabecera lote import SF';

-- T02 archivo
CREATE TABLE IF NOT EXISTS public.sf_archivo (
  id                bigserial PRIMARY KEY,
  corte_id          bigint NOT NULL REFERENCES public.sf_corte (id) ON DELETE CASCADE,
  nombre            text NOT NULL,
  path_relativo     text,
  bytes             bigint,
  sha256            text,
  tipo_codigo       text REFERENCES public.sf_tipo_reporte (codigo),
  programa_erp      text,
  confianza         numeric(5, 4),
  huella            text,
  columnas_detectadas jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sf_archivo_corte ON public.sf_archivo (corte_id);
CREATE INDEX IF NOT EXISTS idx_sf_archivo_tipo ON public.sf_archivo (tipo_codigo);

COMMENT ON TABLE public.sf_archivo IS 'T02 · archivo del lote SF';

-- T04 huellas
CREATE TABLE IF NOT EXISTS public.sf_huella_erp (
  id                bigserial PRIMARY KEY,
  tipo_codigo       text NOT NULL REFERENCES public.sf_tipo_reporte (codigo),
  huella_norm       text NOT NULL,
  programa_erp      text,
  aprobado          boolean NOT NULL DEFAULT true,
  notas             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_sf_huella_tipo_norm UNIQUE (tipo_codigo, huella_norm)
);

CREATE INDEX IF NOT EXISTS idx_sf_huella_tipo ON public.sf_huella_erp (tipo_codigo);

COMMENT ON TABLE public.sf_huella_erp IS 'T04 · memoria de huellas ERP aceptadas';

-- T05 variaciones
CREATE TABLE IF NOT EXISTS public.sf_variacion_evento (
  id                bigserial PRIMARY KEY,
  corte_id          bigint NOT NULL REFERENCES public.sf_corte (id) ON DELETE CASCADE,
  archivo_id        bigint REFERENCES public.sf_archivo (id) ON DELETE SET NULL,
  clase             text NOT NULL,
  severidad         text NOT NULL DEFAULT 'media',
  detalle           jsonb NOT NULL DEFAULT '{}'::jsonb,
  decision          text,
  decidido_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_variacion_clase_chk CHECK (
    clase IN ('tipo_nuevo', 'huella_nueva', 'columna_nueva', 'columna_ausente', 'desconocido')
  ),
  CONSTRAINT sf_variacion_sev_chk CHECK (
    severidad IN ('baja', 'media', 'alta')
  ),
  CONSTRAINT sf_variacion_decision_chk CHECK (
    decision IS NULL OR decision IN ('pendiente', 'aprobada', 'rechazada')
  )
);

CREATE INDEX IF NOT EXISTS idx_sf_variacion_corte ON public.sf_variacion_evento (corte_id);

COMMENT ON TABLE public.sf_variacion_evento IS 'T05 · log variaciones por lote';

-- T06 cheques
CREATE TABLE IF NOT EXISTS public.sf_cheque_vencer (
  id                bigserial PRIMARY KEY,
  corte_id          bigint NOT NULL REFERENCES public.sf_corte (id) ON DELETE CASCADE,
  archivo_id        bigint REFERENCES public.sf_archivo (id) ON DELETE SET NULL,
  mes_ym            text,
  banco_cod         text,
  nro_cheque        text,
  cod_cliente       text,
  fecha_vto         text,
  importe           bigint NOT NULL DEFAULT 0,
  moneda            text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sf_cheque_corte_mes ON public.sf_cheque_vencer (corte_id, mes_ym);

COMMENT ON TABLE public.sf_cheque_vencer IS 'T06 · staging cheques a vencer';

-- T07 saldo cliente resumen
CREATE TABLE IF NOT EXISTS public.sf_saldo_cliente (
  id                bigserial PRIMARY KEY,
  corte_id          bigint NOT NULL REFERENCES public.sf_corte (id) ON DELETE CASCADE,
  archivo_id        bigint REFERENCES public.sf_archivo (id) ON DELETE SET NULL,
  cod_cliente       text,
  nombre            text,
  moneda            text,
  saldo             bigint NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sf_saldo_cli_corte ON public.sf_saldo_cliente (corte_id);

COMMENT ON TABLE public.sf_saldo_cliente IS 'T07 · staging CxC resumen';

-- T08 saldo factura
CREATE TABLE IF NOT EXISTS public.sf_saldo_factura (
  id                bigserial PRIMARY KEY,
  corte_id          bigint NOT NULL REFERENCES public.sf_corte (id) ON DELETE CASCADE,
  archivo_id        bigint REFERENCES public.sf_archivo (id) ON DELETE SET NULL,
  nro_factura       text,
  cod_cliente       text,
  nombre            text,
  saldo             bigint NOT NULL DEFAULT 0,
  dias_vencido      integer,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sf_saldo_fac_corte ON public.sf_saldo_factura (corte_id);
CREATE INDEX IF NOT EXISTS idx_sf_saldo_fac_dias ON public.sf_saldo_factura (corte_id, dias_vencido);

COMMENT ON TABLE public.sf_saldo_factura IS 'T08 · staging CxC factura + aging';

-- T09 PV PROG
CREATE TABLE IF NOT EXISTS public.sf_pv_prog (
  id                bigserial PRIMARY KEY,
  corte_id          bigint NOT NULL REFERENCES public.sf_corte (id) ON DELETE CASCADE,
  archivo_id        bigint REFERENCES public.sf_archivo (id) ON DELETE SET NULL,
  nro_ped_prov      text,
  proforma          text,
  cod_cliente       text,
  nro_ped_cliente   text,
  cod_operacion     text,
  fecha_pedido      text,
  fecha_entrega     text,
  importe_pedido    bigint,
  cant_cuotas       integer,
  importe_cuota     bigint,
  vencimientos      text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sf_pv_corte ON public.sf_pv_prog (corte_id);

COMMENT ON TABLE public.sf_pv_prog IS 'T09 · staging PV Y PROG';

-- T10 ventas ERP genérico
CREATE TABLE IF NOT EXISTS public.sf_venta_erp (
  id                bigserial PRIMARY KEY,
  corte_id          bigint NOT NULL REFERENCES public.sf_corte (id) ON DELETE CASCADE,
  archivo_id        bigint REFERENCES public.sf_archivo (id) ON DELETE SET NULL,
  subtipo           text,
  nro_documento     text,
  cod_cliente       text,
  importe           bigint,
  extra             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sf_venta_corte ON public.sf_venta_erp (corte_id);

COMMENT ON TABLE public.sf_venta_erp IS 'T10 · staging ventas ERP (flex)';

-- T11 manuales
CREATE TABLE IF NOT EXISTS public.sf_manual_linea (
  id                bigserial PRIMARY KEY,
  corte_id          bigint NOT NULL REFERENCES public.sf_corte (id) ON DELETE CASCADE,
  mes_ym            text,
  concepto          text NOT NULL,
  importe_gs        numeric(20, 2),
  importe_usd       numeric(20, 6),
  notas             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sf_manual_corte ON public.sf_manual_linea (corte_id);

COMMENT ON TABLE public.sf_manual_linea IS 'T11 · líneas manuales Sit Fin';

-- T12 snapshot Sit Fin
CREATE TABLE IF NOT EXISTS public.sf_sit_fin_linea (
  id                bigserial PRIMARY KEY,
  corte_id          bigint NOT NULL REFERENCES public.sf_corte (id) ON DELETE CASCADE,
  mes_ym            text,
  concepto          text NOT NULL,
  importe_gs        numeric(20, 2) NOT NULL DEFAULT 0,
  importe_usd       numeric(20, 6),
  origen            text NOT NULL DEFAULT 'auto',
  archivo_id        bigint REFERENCES public.sf_archivo (id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_sit_fin_origen_chk CHECK (origen IN ('auto', 'manual'))
);

CREATE INDEX IF NOT EXISTS idx_sf_sit_fin_corte ON public.sf_sit_fin_linea (corte_id, mes_ym);

COMMENT ON TABLE public.sf_sit_fin_linea IS 'T12 · snapshot tablero SIT FIN';

-- Seed tipos base (T03)
INSERT INTO public.sf_tipo_reporte (codigo, descripcion, parser_version, columnas_esperadas) VALUES
  ('cheques_vencer', 'Cheques a vencer', 1, '["Banco_Cod","Nro_Cheque","Cod_Cliente","Fecha_Vto","Importe","Moneda"]'::jsonb),
  ('saldos_resumen', 'Saldos clientes resumen', 1, '["Nombre","Cod_Cliente","Moneda","Saldo"]'::jsonb),
  ('saldos_detallado', 'Saldos clientes detallado', 1, '["Nro_Factura","Cod_Cliente","Nombre","Saldo","Dias_Vencido"]'::jsonb),
  ('saldos', 'Saldos genérico', 1, '["Nombre","Cod_Cliente","Moneda","Saldo"]'::jsonb),
  ('pv_prog', 'PV Y programaciones', 1, '["Nro_Ped_Prov","Proforma","Cod_Cliente","Importe_Cuota","Vencimientos"]'::jsonb),
  ('ventas_bzz', 'Informe ventas Bazzar', 1, '[]'::jsonb),
  ('ventas_dto', 'Ventas con descuento', 1, '[]'::jsonb),
  ('ventas_mensuales', 'Libro ventas mensuales', 1, '[]'::jsonb),
  ('ventas_dia', 'Ventas por día control', 1, '[]'::jsonb),
  ('ventas', 'Ventas genérico', 1, '[]'::jsonb),
  ('pagos', 'Cierre de pagos', 1, '[]'::jsonb),
  ('cheques_depositados', 'Cheques depositados', 1, '[]'::jsonb),
  ('desconocido', 'Sin clasificar', 1, '[]'::jsonb)
ON CONFLICT (codigo) DO UPDATE SET
  descripcion = EXCLUDED.descripcion,
  updated_at = now();

COMMIT;

SELECT 'MIG-203 OK: sf_* T01–T12' AS estado;
