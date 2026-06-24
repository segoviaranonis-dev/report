-- =====================================================
-- MIGRACIÓN RRHH: Tablas entes + funcionarios
-- Proyecto: Report (rimec-report)
-- Fecha: 2026-06-13
-- =====================================================

-- TABLA: entes
-- Propósito: Normalizar entidades del holding Nexus
CREATE TABLE IF NOT EXISTS entes (
  id_ente SERIAL PRIMARY KEY,
  codigo INTEGER UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('empresa', 'tienda')),
  activo BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Índice único en código
CREATE UNIQUE INDEX IF NOT EXISTS idx_entes_codigo ON entes(codigo);

-- Comentarios
COMMENT ON TABLE entes IS 'Entidades del holding Nexus (empresas + tiendas)';
COMMENT ON COLUMN entes.codigo IS 'Código único del ente (1-5)';
COMMENT ON COLUMN entes.tipo IS 'Tipo: empresa | tienda';

-- Datos iniciales: 5 entes
INSERT INTO entes (codigo, nombre, tipo) VALUES
  (1, 'RIMEC', 'empresa'),
  (2, 'Fernando', 'tienda'),
  (3, 'San Martín', 'tienda'),
  (4, 'Palma', 'tienda'),
  (5, 'Bazzar Web', 'empresa')
ON CONFLICT (codigo) DO NOTHING;

-- =====================================================

-- TABLA: funcionarios
-- Propósito: Registro normalizado de empleados del holding
CREATE TABLE IF NOT EXISTS funcionarios (
  -- PK
  id_funcionario SERIAL PRIMARY KEY,

  -- FK a ente
  ente_id INTEGER NOT NULL REFERENCES entes(id_ente) ON DELETE RESTRICT,

  -- Datos personales
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  nombre_completo TEXT GENERATED ALWAYS AS (nombres || ' ' || apellidos) STORED,
  ci TEXT UNIQUE NOT NULL,
  sexo CHAR(1) CHECK (sexo IN ('M', 'F')),
  fecha_nacimiento DATE,

  -- Datos laborales
  departamento TEXT NOT NULL,
  cargo TEXT NOT NULL,
  item INTEGER,
  fecha_ingreso_ips DATE NOT NULL,

  -- Antigüedad (calculada)
  antiguedad_anios INTEGER,
  antiguedad_meses INTEGER,

  -- Metadatos
  activo BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_funcionarios_ente ON funcionarios(ente_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_funcionarios_ci ON funcionarios(ci);
CREATE INDEX IF NOT EXISTS idx_funcionarios_departamento ON funcionarios(departamento);
CREATE INDEX IF NOT EXISTS idx_funcionarios_cargo ON funcionarios(cargo);
CREATE INDEX IF NOT EXISTS idx_funcionarios_activo ON funcionarios(activo);
CREATE INDEX IF NOT EXISTS idx_funcionarios_nombre ON funcionarios(nombre_completo);

-- Comentarios
COMMENT ON TABLE funcionarios IS 'Empleados del holding Nexus';
COMMENT ON COLUMN funcionarios.nombre_completo IS 'Generado automáticamente desde nombres + apellidos';
COMMENT ON COLUMN funcionarios.ci IS 'Cédula de identidad (único)';
COMMENT ON COLUMN funcionarios.antiguedad_anios IS 'Años de antigüedad (calculado al insertar/actualizar)';

-- =====================================================

-- TRIGGER: Actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_funcionarios_updated_at
  BEFORE UPDATE ON funcionarios
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================

-- TRIGGER: Calcular antigüedad automáticamente
CREATE OR REPLACE FUNCTION actualizar_antiguedad()
RETURNS TRIGGER AS $$
DECLARE
  v_anios INTEGER;
  v_meses INTEGER;
BEGIN
  -- Calcular antigüedad desde fecha_ingreso_ips
  SELECT
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, NEW.fecha_ingreso_ips))::INTEGER,
    EXTRACT(MONTH FROM AGE(CURRENT_DATE, NEW.fecha_ingreso_ips))::INTEGER
  INTO v_anios, v_meses;

  NEW.antiguedad_anios := v_anios;
  NEW.antiguedad_meses := v_meses;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actualizar_antiguedad
  BEFORE INSERT OR UPDATE OF fecha_ingreso_ips ON funcionarios
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_antiguedad();

-- =====================================================

-- RLS (Row Level Security) - Opcional según configuración Supabase
-- Descomentar si se usa RLS en Supabase

-- ALTER TABLE entes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE funcionarios ENABLE ROW LEVEL SECURITY;

-- Policy: Admin puede ver todo
-- CREATE POLICY admin_all_funcionarios ON funcionarios
--   FOR ALL
--   TO authenticated
--   USING (
--     (SELECT rol_id FROM usuario_v2 WHERE id_usuario = auth.uid()) = 1
--   );

-- Policy: Supervisor solo lectura
-- CREATE POLICY supervisor_read_funcionarios ON funcionarios
--   FOR SELECT
--   TO authenticated
--   USING (
--     (SELECT rol_id FROM usuario_v2 WHERE id_usuario = auth.uid()) IN (1, 2)
--   );

-- =====================================================

-- VERIFICACIÓN: Contar registros
SELECT
  'entes' AS tabla,
  COUNT(*) AS registros
FROM entes
UNION ALL
SELECT
  'funcionarios' AS tabla,
  COUNT(*) AS registros
FROM funcionarios;

-- =====================================================
-- FIN MIGRACIÓN RRHH
-- =====================================================
