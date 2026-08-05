-- 192 · Automatización envío informes (PE / CP) · parámetros rígidos en SQL
-- PDF: 1 archivo por marca+caso · segregación obligatoria LPN vs LPC03 (backend).
-- Front solo configura; el envío no depende del navegador.

CREATE TABLE IF NOT EXISTS public.informe_automatizacion_envio (
  id                      bigserial PRIMARY KEY,
  codigo                  text NOT NULL UNIQUE,
  nombre                  text NOT NULL,
  origen_stock            text NOT NULL
    CHECK (origen_stock IN ('COMPRA_PREVIA', 'PRONTA_ENTREGA')),
  depositos               text[] NOT NULL DEFAULT '{}',
  ramo                    text NOT NULL
    CHECK (ramo IN ('CALZADO', 'CONFECCIONES')),
  marcas                  text[] NOT NULL DEFAULT '{}',
  abcr_labels             text[] NOT NULL DEFAULT '{}',
  tipos_dpe               text[] NOT NULL DEFAULT '{}',
  biblioteca_precio_ids   bigint[] NOT NULL DEFAULT '{}',
  -- Reglas PDF inviolables (no se apagan desde UI)
  segregar_lpn_lpc03      boolean NOT NULL DEFAULT true,
  pdf_por_marca_caso      boolean NOT NULL DEFAULT true,
  activo                  boolean NOT NULL DEFAULT true,
  created_by_usuario_id   bigint NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT informe_auto_depositos_chk CHECK (
    depositos <@ ARRAY['D1', 'DEP2', 'D3']::text[]
  )
);

COMMENT ON TABLE public.informe_automatizacion_envio IS
  '2.3.1.35 · Automatización PDF/mail · filtros + reglas LPN/LPC03 · sin dependencia del front';
COMMENT ON COLUMN public.informe_automatizacion_envio.tipos_dpe IS
  'Cadenas DPE: REGULAR|PROMOCIONAL|LIQUIDACION|COMUN (COD.GRUPO triunvirato)';
COMMENT ON COLUMN public.informe_automatizacion_envio.abcr_labels IS
  'AB-CR Tipo1 canónico (ABIERTO|CERRADO|MEDIAS|… ) · hermanos siameses';
COMMENT ON COLUMN public.informe_automatizacion_envio.segregar_lpn_lpc03 IS
  'Crítico: PDF LPN separado de LPC03 — misma lógica segmentación facturas';

CREATE TABLE IF NOT EXISTS public.informe_automatizacion_destinatario (
  id                      bigserial PRIMARY KEY,
  automatizacion_id       bigint NOT NULL
    REFERENCES public.informe_automatizacion_envio(id) ON DELETE CASCADE,
  usuario_id              bigint NULL,
  nombre                  text NOT NULL,
  email                   text NOT NULL,
  horario                 time NOT NULL DEFAULT '08:00',
  veces_por_dia           int NOT NULL DEFAULT 1
    CHECK (veces_por_dia >= 1 AND veces_por_dia <= 24),
  dias_semana             int[] NOT NULL DEFAULT '{1,2,3,4,5}',
  activo                  boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_informe_auto_dest_auto
  ON public.informe_automatizacion_destinatario (automatizacion_id)
  WHERE activo = true;

CREATE INDEX IF NOT EXISTS idx_informe_auto_envio_activo
  ON public.informe_automatizacion_envio (activo, origen_stock)
  WHERE activo = true;
