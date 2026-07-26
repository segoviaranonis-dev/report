-- MIG-180 · Diccionario Pronta Entrega — cadena comercial + descuento D1
-- Director 2026-07-24 · Mario Bros · LIQ/PROMO 2% · REGULAR 4%

CREATE TABLE IF NOT EXISTS public.pe_diccionario_cadena (
  cadena_pe           text PRIMARY KEY,
  descuento_d1_pct    numeric(5, 2) NOT NULL,
  es_liquidacion      boolean NOT NULL DEFAULT false,
  es_promo            boolean NOT NULL DEFAULT false,
  excluir_catalogo    boolean NOT NULL DEFAULT false,
  etiqueta_ui         text NOT NULL,
  notas               text,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pe_diccionario_cadena IS
  'Diccionario PE Nexus · descuento D1 y reglas FI · sin motor precios';

INSERT INTO public.pe_diccionario_cadena (cadena_pe, descuento_d1_pct, es_liquidacion, es_promo, etiqueta_ui, notas)
VALUES
  ('REGULAR',      4.00, false, false, 'NORMAL',     'Cadena estándar PE'),
  ('PROMOCIONAL',  2.00, false, true,  'PROMOCIONAL', 'Promo SDRM / COD.GRUPO d45 o d67=03'),
  ('LIQUIDACION',  2.00, true,  false, 'LIQUIDACION', 'Latido verde catálogo Web')
ON CONFLICT (cadena_pe) DO UPDATE SET
  descuento_d1_pct = EXCLUDED.descuento_d1_pct,
  es_liquidacion   = EXCLUDED.es_liquidacion,
  es_promo         = EXCLUDED.es_promo,
  etiqueta_ui      = EXCLUDED.etiqueta_ui,
  notas            = EXCLUDED.notas,
  updated_at       = now();

CREATE OR REPLACE FUNCTION public.pe_descuento_diccionario(p_cadena text)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT descuento_d1_pct FROM public.pe_diccionario_cadena
     WHERE upper(btrim(cadena_pe)) = upper(btrim(COALESCE(p_cadena, 'REGULAR')))),
    (SELECT descuento_d1_pct FROM public.pe_diccionario_cadena WHERE cadena_pe = 'REGULAR'),
    4.00
  );
$$;

COMMENT ON FUNCTION public.pe_descuento_diccionario IS
  'Descuento D1 PE desde diccionario · fallback REGULAR 4%';

-- Enriquecer vista PE con descuento diccionario (solo lectura catálogo / carrito)
CREATE OR REPLACE VIEW public.v_pe_diccionario_impacto AS
SELECT
  upper(btrim(COALESCE(v.cadena_comercial, 'REGULAR'))) AS cadena_pe,
  d.descuento_d1_pct,
  d.etiqueta_ui,
  count(*)::bigint AS filas,
  count(DISTINCT (v.linea_codigo, v.referencia_codigo, v.material_code, v.color_code))::bigint AS moleculas,
  sum(GREATEST(v.saldo_pares, 0))::bigint AS pares_saldo
FROM public.v_stock_pe_rimec v
LEFT JOIN public.pe_diccionario_cadena d
  ON upper(btrim(d.cadena_pe)) = upper(btrim(COALESCE(v.cadena_comercial, 'REGULAR')))
WHERE GREATEST(v.saldo_pares, 0) > 0
GROUP BY 1, 2, 3
ORDER BY pares_saldo DESC;
