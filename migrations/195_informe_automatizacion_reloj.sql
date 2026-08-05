-- 195 · Reloj de automatización: días de semana + log anti-doble disparo
-- ISO: 1=lunes … 7=domingo · zona operativa America/Asuncion

ALTER TABLE public.informe_automatizacion_envio
  ADD COLUMN IF NOT EXISTS dias_semana int[] NOT NULL DEFAULT '{1,2,3,4,5,6,7}'::int[];

ALTER TABLE public.informe_automatizacion_envio
  DROP CONSTRAINT IF EXISTS informe_auto_dias_semana_chk;

ALTER TABLE public.informe_automatizacion_envio
  ADD CONSTRAINT informe_auto_dias_semana_chk CHECK (
    dias_semana <> '{}'
    AND dias_semana <@ ARRAY[1,2,3,4,5,6,7]::int[]
  );

COMMENT ON COLUMN public.informe_automatizacion_envio.dias_semana IS
  'Días ISO 1=lun…7=dom en que corren los horarios[]. Reloj worker · sin interacción humana.';

CREATE TABLE IF NOT EXISTS public.informe_automatizacion_tick (
  automatizacion_id  bigint NOT NULL
    REFERENCES public.informe_automatizacion_envio(id) ON DELETE CASCADE,
  slot_key           text NOT NULL,
  horario            time NOT NULL,
  executed_at        timestamptz NOT NULL DEFAULT now(),
  ok                 boolean NOT NULL DEFAULT true,
  detalle            text NULL,
  PRIMARY KEY (automatizacion_id, slot_key)
);

CREATE INDEX IF NOT EXISTS idx_informe_auto_tick_executed
  ON public.informe_automatizacion_tick (executed_at DESC);

COMMENT ON TABLE public.informe_automatizacion_tick IS
  'Anti-doble: un slot (fecha+hora) por automatización. Ej. 2026-08-04T08:03';
