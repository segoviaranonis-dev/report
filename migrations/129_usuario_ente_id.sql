-- Espejo 129 — python scripts/aplicar_migracion_129.py

BEGIN;

ALTER TABLE public.entes
  ADD COLUMN IF NOT EXISTS cliente_id INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_entes_cliente_id
  ON public.entes (cliente_id)
  WHERE cliente_id IS NOT NULL;

INSERT INTO public.entes (codigo, nombre, tipo, cliente_id) VALUES
  (6,  'Fernando · Adultos',    'tienda', 2100),
  (7,  'Fernando · Niños',      'tienda', 2900),
  (8,  'San Martín · Adultos',  'tienda', 2400),
  (9,  'San Martín · Niños',    'tienda', 2700),
  (10, 'Palma · Adultos',       'tienda', 3100),
  (11, 'Palma · Niños',         'tienda', 3200),
  (12, 'Bazzar Web · E-commerce', 'empresa', 5000)
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  tipo = EXCLUDED.tipo,
  cliente_id = EXCLUDED.cliente_id,
  activo = true;

ALTER TABLE public.usuario_v2 DROP CONSTRAINT IF EXISTS chk_usuario_v2_entidad_holding;
DROP INDEX IF EXISTS idx_usuario_v2_entidad_holding;
ALTER TABLE public.usuario_v2 DROP COLUMN IF EXISTS entidad_holding;

ALTER TABLE public.usuario_v2
  ADD COLUMN IF NOT EXISTS ente_id INTEGER REFERENCES public.entes(id_ente) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_usuario_v2_ente_id ON public.usuario_v2 (ente_id);

UPDATE public.usuario_v2 u
SET ente_id = e.id_ente
FROM public.entes e
WHERE u.ente_id IS NULL
  AND (
    (u.rol_id = 2 AND e.codigo = 6)
    OR (u.rol_id <> 2 AND e.codigo = 1)
  );

COMMIT;
