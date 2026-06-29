-- Espejo de control_central/migrations/127_usuario_categoria.sql
-- Aplicar: python scripts/aplicar_migracion_127.py

BEGIN;

CREATE TABLE IF NOT EXISTS public.usuario_categoria (
  id_categoria   SERIAL PRIMARY KEY,
  rol_id         int2 NOT NULL REFERENCES public.maestro_rol_acceso(id) ON DELETE RESTRICT,
  codigo         text NOT NULL,
  descripcion    text,
  activo         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_usuario_categoria_rol_codigo UNIQUE (rol_id, codigo),
  CONSTRAINT chk_usuario_categoria_codigo_no_vacio CHECK (btrim(codigo) <> '')
);

CREATE INDEX IF NOT EXISTS idx_usuario_categoria_rol_id
  ON public.usuario_categoria (rol_id);

CREATE INDEX IF NOT EXISTS idx_usuario_categoria_activo
  ON public.usuario_categoria (activo)
  WHERE activo = true;

COMMENT ON TABLE public.usuario_categoria IS
  'Catálogo holding de categorías por rol (empresa). Matiza permisos dentro de usuario_v2.rol_id.';

INSERT INTO public.usuario_categoria (rol_id, codigo, descripcion) VALUES
  (1, 'DIOS',     'Nivel Dios · acceso total holding (rol_id=1)'),
  (1, 'ADMIN',    'Administrador RIMEC · todo Report salvo Aprobaciones si no es DIOS'),
  (1, 'VENDEDOR', 'Vendedor RIMEC · Report solo ventas-fotos'),
  (2, 'ADMIN',    'Administrador Bazzar · Report solo módulos Bazzar'),
  (2, 'VENDEDOR', 'Vendedor Bazzar · tablet POS · sin Report web')
ON CONFLICT (rol_id, codigo) DO UPDATE SET
  descripcion = EXCLUDED.descripcion,
  activo = true,
  updated_at = now();

COMMIT;
