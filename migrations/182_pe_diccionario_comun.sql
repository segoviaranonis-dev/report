-- MIG-182 · División FI PE «COMUN» — Mario Bros · d45=06 · TIPO1 Carlos
-- Director 2026-07-25 · 4.ª cadena diccionario (NORMAL · PROMO · LIQ · COMUN)

INSERT INTO public.pe_diccionario_cadena (cadena_pe, descuento_d1_pct, es_liquidacion, es_promo, etiqueta_ui, notas)
VALUES (
  'COMUN',
  4.00,
  false,
  false,
  'COMUN',
  'Línea comercial Carlos TIPO1=COMUN · calzado COD.GRUPO d45=06 · FI segregada R-FI-2'
)
ON CONFLICT (cadena_pe) DO UPDATE SET
  descuento_d1_pct = EXCLUDED.descuento_d1_pct,
  es_liquidacion = EXCLUDED.es_liquidacion,
  es_promo = EXCLUDED.es_promo,
  etiqueta_ui = EXCLUDED.etiqueta_ui,
  notas = EXCLUDED.notas,
  updated_at = now();

INSERT INTO public.grupo_digito_mapa (ramo, posicion, codigo, destino, label_canonico)
VALUES ('CALZADOS', '45', '06', 'cadena', 'COMUN')
ON CONFLICT (ramo, posicion, codigo, destino) DO UPDATE SET
  label_canonico = EXCLUDED.label_canonico;

CREATE OR REPLACE FUNCTION public.sdrm_resolver_cadena_comercial(
  p_ramo text,
  p_t0 text,
  p_t1 text,
  p_t2 text
) RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_ramo text := upper(btrim(COALESCE(p_ramo, '')));
  v_t0 text := upper(btrim(COALESCE(p_t0, '')));
  v_t1 text := upper(btrim(COALESCE(p_t1, '')));
  v_t2 text := upper(btrim(COALESCE(p_t2, '')));
BEGIN
  IF v_ramo LIKE '%CONF%' THEN
    IF v_t2 LIKE '%LIQUID%' THEN RETURN 'LIQUIDACION'; END IF;
  ELSE
    IF v_t1 LIKE '%LIQUID%' THEN RETURN 'LIQUIDACION'; END IF;
    IF v_t1 = 'COMUN' OR v_t1 LIKE 'COMUN%' THEN RETURN 'COMUN'; END IF;
  END IF;
  IF v_t0 LIKE '%PROM%' OR v_t1 LIKE '%PROM%' OR v_t2 LIKE '%PROM%' THEN
    RETURN 'PROMOCIONAL';
  END IF;
  RETURN 'REGULAR';
END;
$$;

COMMENT ON FUNCTION public.sdrm_resolver_cadena_comercial IS
  'Cadena PE desde labels SDRM · COMUN (TIPO1) · LIQ · PROMO · REGULAR';

-- Materializar dimensión + PPD desde dígito d45=06 (calzado 654)
UPDATE public.sdrm_cod_grupo_dim
SET cadena_comercial = 'COMUN',
    es_liquidacion = false,
    es_promo = false,
    updated_at = now()
WHERE length(btrim(cod_grupo)) >= 6
  AND substring(btrim(cod_grupo) from 5 for 2) = '06'
  AND substring(btrim(cod_grupo) from 1 for 2) NOT IN ('10', '11', '12', '13', '14', '15');

UPDATE public.pedido_proveedor_detalle ppd
SET am_cadena_comercial = 'COMUN',
    am_es_liquidacion = false
FROM public.pedido_proveedor pp
WHERE pp.id = ppd.pedido_proveedor_id
  AND pp.entidad_comercial = 'STOCK'
  AND pp.deposito_codigo IS NOT NULL
  AND ppd.am_cod_grupo IS NOT NULL
  AND length(btrim(ppd.am_cod_grupo)) >= 6
  AND substring(btrim(ppd.am_cod_grupo) from 5 for 2) = '06'
  AND substring(btrim(ppd.am_cod_grupo) from 1 for 2) NOT IN ('10', '11', '12', '13', '14', '15');
