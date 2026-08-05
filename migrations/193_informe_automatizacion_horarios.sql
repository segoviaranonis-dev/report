-- 193 · Varios horarios por automatización (anti-saturación de jobs)
-- Ej.: Moleca → {08:00,12:00,15:00} · Vizzano → {07:00} (otra automatización).
-- Destinatarios = multi usuario_v2; el cron usa horarios[] del envío.

ALTER TABLE public.informe_automatizacion_envio
  ADD COLUMN IF NOT EXISTS horarios time[] NOT NULL DEFAULT '{08:00}'::time[];

COMMENT ON COLUMN public.informe_automatizacion_envio.horarios IS
  'Horas de ejecución del día (HH:MM). Una automatización = un paquete de filtros+PDFs; varios horarios espacian la carga.';

-- Destinatario: horario por fila queda legado; el canónico es envio.horarios.
COMMENT ON COLUMN public.informe_automatizacion_destinatario.horario IS
  'LEGADO · preferir informe_automatizacion_envio.horarios (mismo set para todos los destinatarios del envío)';
