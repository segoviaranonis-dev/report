-- 194 · Mensajes internos (2.3.1.36) · bandeja Nexus sin IMAP
-- Los PDF de Automatización (2.3.1.35) se depositan aquí al enviar (espejo del correo).

CREATE TABLE IF NOT EXISTS public.mensaje_interno_carpeta (
  id          bigserial PRIMARY KEY,
  codigo      text NOT NULL UNIQUE,
  nombre      text NOT NULL,
  orden       int NOT NULL DEFAULT 100,
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.mensaje_interno_carpeta IS
  '2.3.1.36 · Carpetas de bandeja (ej. Stock pronta entrega)';

INSERT INTO public.mensaje_interno_carpeta (codigo, nombre, orden)
VALUES
  ('STOCK_PRONTA_ENTREGA', 'Stock pronta entrega', 10),
  ('GENERAL', 'General', 90)
ON CONFLICT (codigo) DO UPDATE
SET nombre = EXCLUDED.nombre,
    orden = EXCLUDED.orden,
    activo = true;

CREATE TABLE IF NOT EXISTS public.mensaje_interno (
  id                      bigserial PRIMARY KEY,
  carpeta_id              bigint NOT NULL
    REFERENCES public.mensaje_interno_carpeta(id),
  origen                  text NOT NULL DEFAULT 'AUTOMATIZACION'
    CHECK (origen IN ('AUTOMATIZACION', 'SISTEMA', 'USUARIO')),
  -- Soft-link a 2.3.1.35 (sin FK rígida: mig 192 puede no estar en todos los entornos)
  automatizacion_id       bigint NULL,
  asunto                  text NOT NULL,
  cuerpo                  text NOT NULL DEFAULT '',
  created_by_usuario_id   bigint NULL,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensaje_interno_carpeta_created
  ON public.mensaje_interno (carpeta_id, created_at DESC);

COMMENT ON TABLE public.mensaje_interno IS
  '2.3.1.36 · Mensaje interno (no IMAP). Espejo de envíos PE/automatización.';

CREATE TABLE IF NOT EXISTS public.mensaje_interno_destinatario (
  id              bigserial PRIMARY KEY,
  mensaje_id      bigint NOT NULL
    REFERENCES public.mensaje_interno(id) ON DELETE CASCADE,
  usuario_id      bigint NOT NULL,
  leido_at        timestamptz NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mensaje_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_mensaje_interno_dest_usuario
  ON public.mensaje_interno_destinatario (usuario_id, leido_at);

COMMENT ON TABLE public.mensaje_interno_destinatario IS
  'Lectura por usuario_v2 · bandeja personal';

CREATE TABLE IF NOT EXISTS public.mensaje_interno_adjunto (
  id              bigserial PRIMARY KEY,
  mensaje_id      bigint NOT NULL
    REFERENCES public.mensaje_interno(id) ON DELETE CASCADE,
  nombre_archivo  text NOT NULL,
  storage_path    text NULL,
  mime            text NOT NULL DEFAULT 'application/pdf',
  bytes           bigint NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensaje_interno_adj_msg
  ON public.mensaje_interno_adjunto (mensaje_id);

COMMENT ON TABLE public.mensaje_interno_adjunto IS
  'PDF/adjunto · path storage o job_id · no MIME gigante en PG';
