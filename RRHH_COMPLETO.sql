-- =====================================================
-- NEXUS CORE - MÓDULO RRHH COMPLETO
-- Proyecto: Report (rimec-report)
-- Fecha: 2026-06-13
--
-- INSTRUCCIONES:
-- 1. Copiar TODO este archivo
-- 2. Pegar en Supabase SQL Editor
-- 3. Click en RUN
-- =====================================================

-- =====================================================
-- PARTE 1: TABLAS BASE (entes + funcionarios)
-- =====================================================

-- TABLA: entes
CREATE TABLE IF NOT EXISTS entes (
  id_ente SERIAL PRIMARY KEY,
  codigo INTEGER UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('empresa', 'tienda')),
  activo BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_entes_codigo ON entes(codigo);

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
CREATE TABLE IF NOT EXISTS funcionarios (
  id_funcionario SERIAL PRIMARY KEY,
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

  -- Antigüedad
  antiguedad_anios INTEGER,
  antiguedad_meses INTEGER,

  -- Metadatos
  activo BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_funcionarios_ente ON funcionarios(ente_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_funcionarios_ci ON funcionarios(ci);
CREATE INDEX IF NOT EXISTS idx_funcionarios_departamento ON funcionarios(departamento);
CREATE INDEX IF NOT EXISTS idx_funcionarios_cargo ON funcionarios(cargo);
CREATE INDEX IF NOT EXISTS idx_funcionarios_activo ON funcionarios(activo);
CREATE INDEX IF NOT EXISTS idx_funcionarios_nombre ON funcionarios(nombre_completo);

COMMENT ON TABLE funcionarios IS 'Empleados del holding Nexus';
COMMENT ON COLUMN funcionarios.nombre_completo IS 'Generado automáticamente';

-- =====================================================

-- TRIGGER: updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_funcionarios_updated_at ON funcionarios;
CREATE TRIGGER trigger_update_funcionarios_updated_at
  BEFORE UPDATE ON funcionarios
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- TRIGGER: Calcular antigüedad
CREATE OR REPLACE FUNCTION actualizar_antiguedad()
RETURNS TRIGGER AS $$
DECLARE
  v_anios INTEGER;
  v_meses INTEGER;
BEGIN
  SELECT
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, NEW.fecha_ingreso_ips))::INTEGER,
    EXTRACT(MONTH FROM AGE(CURRENT_DATE, NEW.fecha_ingreso_ips))::INTEGER
  INTO v_anios, v_meses;

  NEW.antiguedad_anios := v_anios;
  NEW.antiguedad_meses := v_meses;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_actualizar_antiguedad ON funcionarios;
CREATE TRIGGER trigger_actualizar_antiguedad
  BEFORE INSERT OR UPDATE OF fecha_ingreso_ips ON funcionarios
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_antiguedad();

-- =====================================================
-- PARTE 2: MÓDULO VACACIONES
-- =====================================================

-- TABLA: vacaciones
CREATE TABLE IF NOT EXISTS vacaciones (
  id_vacacion SERIAL PRIMARY KEY,
  funcionario_id INTEGER NOT NULL REFERENCES funcionarios(id_funcionario) ON DELETE RESTRICT,

  anio INTEGER NOT NULL,
  dias_totales INTEGER NOT NULL DEFAULT 30,
  dias_tomados INTEGER NOT NULL DEFAULT 0,
  dias_pendientes INTEGER GENERATED ALWAYS AS (dias_totales - dias_tomados) STORED,

  activo BOOLEAN DEFAULT true NOT NULL,
  notas TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,

  UNIQUE(funcionario_id, anio)
);

CREATE INDEX IF NOT EXISTS idx_vacaciones_funcionario ON vacaciones(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_vacaciones_anio ON vacaciones(anio);
CREATE INDEX IF NOT EXISTS idx_vacaciones_activo ON vacaciones(activo);

COMMENT ON TABLE vacaciones IS 'Registro de vacaciones por funcionario por año';

DROP TRIGGER IF EXISTS trigger_update_vacaciones_updated_at ON vacaciones;
CREATE TRIGGER trigger_update_vacaciones_updated_at
  BEFORE UPDATE ON vacaciones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================

-- TABLA: vacaciones_detalle (historial)
CREATE TABLE IF NOT EXISTS vacaciones_detalle (
  id_detalle SERIAL PRIMARY KEY,
  vacacion_id INTEGER NOT NULL REFERENCES vacaciones(id_vacacion) ON DELETE CASCADE,

  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  dias_tomados INTEGER NOT NULL,

  estado VARCHAR(20) DEFAULT 'aprobado' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
  motivo TEXT,
  aprobado_por INTEGER REFERENCES funcionarios(id_funcionario),
  fecha_aprobacion TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vacaciones_detalle_vacacion ON vacaciones_detalle(vacacion_id);
CREATE INDEX IF NOT EXISTS idx_vacaciones_detalle_estado ON vacaciones_detalle(estado);

-- =====================================================

-- VISTA: vacaciones_funcionarios
CREATE OR REPLACE VIEW vacaciones_funcionarios AS
SELECT
  v.id_vacacion,
  v.anio,
  v.dias_totales,
  v.dias_tomados,
  v.dias_pendientes,
  v.notas,
  v.activo,
  f.id_funcionario,
  f.ente_id,
  f.nombres,
  f.apellidos,
  f.nombre_completo,
  f.ci,
  f.departamento,
  f.cargo,
  e.nombre AS ente_nombre,
  e.codigo AS ente_codigo
FROM vacaciones v
INNER JOIN funcionarios f ON f.id_funcionario = v.funcionario_id
INNER JOIN entes e ON e.id_ente = f.ente_id
WHERE v.activo = true AND f.activo = true;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

SELECT 'TABLAS CREADAS EXITOSAMENTE' AS resultado;

SELECT
  'entes' AS tabla,
  COUNT(*) AS registros
FROM entes
UNION ALL
SELECT
  'funcionarios' AS tabla,
  COUNT(*) AS registros
FROM funcionarios
UNION ALL
SELECT
  'vacaciones' AS tabla,
  COUNT(*) AS registros
FROM vacaciones;

-- =====================================================
-- FIN SQL
-- =====================================================
