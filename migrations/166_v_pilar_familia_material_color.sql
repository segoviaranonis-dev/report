-- MIG-166 — Vista familia Material/Color (1ª palabra · NN numérico)
-- Latencia: precomputa etiqueta corta en BD para filtros reposición / depósitos.
-- NO aplica clustering Gas/Napa (eso sigue en cliente · agrupar-etiqueta-pilar.ts).
-- Aplicar solo con cierre de etapa u orden directa Director (prod sellada).

CREATE OR REPLACE FUNCTION public.fn_primera_palabra_pilar(p_descripcion text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(
    upper(
      btrim(
        split_part(
          regexp_replace(
            btrim(COALESCE(p_descripcion, '')),
            '[,|–]+',
            '/',
            'g'
          ),
          '/',
          1
        )
      )
    ),
    ''
  );
$$;

COMMENT ON FUNCTION public.fn_primera_palabra_pilar(text) IS
  'MIG-166: 1ª palabra pilar (corta en / espacio vía split). Paridad colorPredominante ligera.';

CREATE OR REPLACE FUNCTION public.fn_familia_pilar_etiqueta(p_descripcion text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN v.pw IS NULL OR v.pw = '' THEN NULL
    WHEN v.pw ~ '^[0-9]+$' THEN 'NN'
    ELSE split_part(v.pw, ' ', 1)
  END
  FROM (
    SELECT public.fn_primera_palabra_pilar(p_descripcion) AS pw
  ) v;
$$;

COMMENT ON FUNCTION public.fn_familia_pilar_etiqueta(text) IS
  'MIG-166: etiqueta familia · solo texto o NN si 1ª palabra es numérica. Sin códigos sueltos.';

CREATE OR REPLACE VIEW public.v_pilar_material_familia AS
SELECT
  m.id AS material_id,
  m.codigo_proveedor,
  m.descripcion,
  public.fn_familia_pilar_etiqueta(m.descripcion::text) AS familia_etiqueta,
  (public.fn_familia_pilar_etiqueta(m.descripcion::text) = 'NN') AS es_nn
FROM public.material m;

CREATE OR REPLACE VIEW public.v_pilar_color_familia AS
SELECT
  c.id AS color_id,
  c.codigo_proveedor,
  c.descripcion,
  public.fn_familia_pilar_etiqueta(c.descripcion::text) AS familia_etiqueta,
  (public.fn_familia_pilar_etiqueta(c.descripcion::text) = 'NN') AS es_nn
FROM public.color c;

COMMENT ON VIEW public.v_pilar_material_familia IS
  'MIG-166: material · familia_etiqueta (texto|NN) para filtros sin listar códigos.';
COMMENT ON VIEW public.v_pilar_color_familia IS
  'MIG-166: color · familia_etiqueta (texto|NN) para filtros sin listar códigos.';
