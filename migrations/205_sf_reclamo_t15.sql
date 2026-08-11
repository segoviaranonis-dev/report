-- MIG-205: Reclamos Sit Fin (T15) — entorno ≠ bugs
-- CHUSAR 2.3.1.50.31 · LAB only hasta cierre etapa / orden Director
-- NO confundir con protocolo_errores (bugs técnicos)

BEGIN;

CREATE TABLE IF NOT EXISTS public.sf_reclamo (
  id                bigserial PRIMARY KEY,
  code              text NOT NULL,
  numero            integer NOT NULL,
  fecha             date NOT NULL,
  lote_id           text NOT NULL,
  concepto_sit_fin  text NOT NULL,
  origen            text NOT NULL DEFAULT 'guido_excel',
  texto_reclamo     text NOT NULL,
  evidencia         text,
  regla_canon       text,
  nexus_antes       text,
  respuesta_nexus   text,
  accion_nexus      text,
  decision_guido    text,
  respuesta_guido   text,
  estado            text NOT NULL DEFAULT 'abierto',
  doc_chusar        text,
  commit_deploy     text,
  naturaleza        text NOT NULL DEFAULT 'reclamo',
  meta              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_reclamo_code_uq UNIQUE (code),
  CONSTRAINT sf_reclamo_naturaleza_chk CHECK (naturaleza = 'reclamo'),
  CONSTRAINT sf_reclamo_estado_chk CHECK (
    estado IN (
      'abierto',
      'en_curso',
      'verificado_canon',
      'verificado_txt',
      'esperando_guido',
      'cerrado',
      'no_aplica_sf_al'
    )
  ),
  CONSTRAINT sf_reclamo_origen_chk CHECK (
    origen IN ('guido_excel', 'guido_verbal', 'auditoria_interna')
  )
);

CREATE INDEX IF NOT EXISTS idx_sf_reclamo_lote ON public.sf_reclamo (lote_id);
CREATE INDEX IF NOT EXISTS idx_sf_reclamo_estado ON public.sf_reclamo (estado);
CREATE INDEX IF NOT EXISTS idx_sf_reclamo_fecha ON public.sf_reclamo (fecha DESC);

COMMENT ON TABLE public.sf_reclamo IS
  'T15 · Reclamos canon SF (Guido). NO bugs — ver protocolo_errores.';

COMMIT;
