-- MIG-205: Padrón TXT ERP por programa Carlos (Hiedra) — no por nombre de archivo
-- Faro Alejandría · Sit Fin isla · LAB hasta cierre etapa / orden Director
-- Clave: programa_erp (ej. ifcqvg$) leído del contenido del TXT

BEGIN;

CREATE TABLE IF NOT EXISTS public.sf_programa_erp (
  programa_erp      text PRIMARY KEY,
  -- Código tal cual aparece en cabecera RIMEC (Carlos), ej. ifcqvg$
  tipo_codigo       text REFERENCES public.sf_tipo_reporte (codigo),
  titulo_informe    text NOT NULL DEFAULT '',
  columnas_cabecera jsonb NOT NULL DEFAULT '[]'::jsonb,
  filtros_tipicos   jsonb NOT NULL DEFAULT '{}'::jsonb,
  parser_key        text,
  -- integra = ya consumimos y parseamos con integridad en Faro
  estado_consumo    text NOT NULL DEFAULT 'detectado',
  n_archivos_lab    integer NOT NULL DEFAULT 0,
  sit_fin_mol_keys  jsonb NOT NULL DEFAULT '[]'::jsonb,
  notas             text,
  primera_vez_at    timestamptz NOT NULL DEFAULT now(),
  ultima_vez_at     timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_programa_estado_chk CHECK (
    estado_consumo IN ('detectado', 'mapeado', 'integro', 'obsoleto')
  )
);

CREATE INDEX IF NOT EXISTS idx_sf_programa_tipo ON public.sf_programa_erp (tipo_codigo);
CREATE INDEX IF NOT EXISTS idx_sf_programa_estado ON public.sf_programa_erp (estado_consumo);

COMMENT ON TABLE public.sf_programa_erp IS
  'T15 · Padrón Hiedra: TXT clasificados por programa_erp (if*), no por título de archivo';

COMMENT ON COLUMN public.sf_programa_erp.programa_erp IS
  'Identificador módulo ERP Carlos en cabecera TXT (ej. ifcqvg$)';

COMMENT ON COLUMN public.sf_programa_erp.estado_consumo IS
  'integro = Faro ya consume con parser + molecular verificable';

-- Índice auxiliar en sf_archivo para buscar por programa
CREATE INDEX IF NOT EXISTS idx_sf_archivo_programa
  ON public.sf_archivo (programa_erp);

COMMIT;
