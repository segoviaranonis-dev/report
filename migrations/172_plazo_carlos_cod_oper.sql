-- MIG-172 · Plazos Carlos — Cod. Oper. canónico (Condiciones - Hector.xlsx col A)
-- Fuente: csv's/stock's/ventas PE/Condiciones - Hector.xlsx
-- CSV PE col "Cod. Oper." = plazo_carlos.cod_oper_carlos

CREATE TABLE IF NOT EXISTS public.plazo_carlos (
  cod_oper_carlos   text PRIMARY KEY,
  dias_vto          text NOT NULL,
  label_ui          text NOT NULL,
  id_plazo          bigint NULL REFERENCES public.plazo_v2 (id_plazo),
  orden             integer NOT NULL DEFAULT 0,
  activo            boolean NOT NULL DEFAULT true,
  fuente_archivo    text NOT NULL DEFAULT 'Condiciones - Hector.xlsx',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.plazo_carlos IS
  'Traductor plazo Carlos · col A Condiciones Hector · CSV Cod. Oper.';

CREATE INDEX IF NOT EXISTS idx_plazo_carlos_id_plazo ON public.plazo_carlos (id_plazo);

ALTER TABLE public.plazo_v2
  ADD COLUMN IF NOT EXISTS cod_oper_carlos text NULL REFERENCES public.plazo_carlos (cod_oper_carlos);

ALTER TABLE public.factura_interna
  ADD COLUMN IF NOT EXISTS cod_oper_carlos text NULL;

ALTER TABLE public.pedido_venta_rimec
  ADD COLUMN IF NOT EXISTS cod_oper_carlos text NULL;

ALTER TABLE public.carrito_sesion
  ADD COLUMN IF NOT EXISTS cod_oper_carlos text NULL;

COMMENT ON COLUMN public.factura_interna.cod_oper_carlos IS
  'Cod. Oper. Carlos inmutable post confirm · CSV PE col 2';
