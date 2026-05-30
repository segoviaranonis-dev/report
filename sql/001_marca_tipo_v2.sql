-- Relacion marca -> tipo para filtros de Report.
-- Ventas con Fotos usa solo CALZADOS (tipo_v2.id_tipo = 1).

CREATE TABLE IF NOT EXISTS public.marca_tipo_v2 (
  id_marca bigint NOT NULL REFERENCES public.marca_v2(id_marca),
  id_tipo bigint NOT NULL REFERENCES public.tipo_v2(id_tipo),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id_marca, id_tipo)
);

-- Marcas 1..9 = CALZADOS
INSERT INTO public.marca_tipo_v2 (id_marca, id_tipo)
SELECT id_marca, 1
FROM public.marca_v2
WHERE id_marca BETWEEN 1 AND 9
ON CONFLICT (id_marca, id_tipo) DO NOTHING;

-- Marcas 10..15 = CONFECCIONES
INSERT INTO public.marca_tipo_v2 (id_marca, id_tipo)
SELECT id_marca, 2
FROM public.marca_v2
WHERE id_marca BETWEEN 10 AND 15
ON CONFLICT (id_marca, id_tipo) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_marca_tipo_v2_tipo
  ON public.marca_tipo_v2 (id_tipo, id_marca);
