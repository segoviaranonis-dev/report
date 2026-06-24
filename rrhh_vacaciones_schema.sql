-- =====================================================
-- EXTENSIÓN RRHH: Tabla Vacaciones
-- Proyecto: Report (rimec-report)
-- Fecha: 2026-06-13
-- PREREQUISITO: Ejecutar rrhh_schema.sql primero
-- =====================================================

-- TABLA: vacaciones
-- Propósito: Registro de vacaciones por funcionario
CREATE TABLE IF NOT EXISTS vacaciones (
  id_vacacion SERIAL PRIMARY KEY,
  funcionario_id INTEGER NOT NULL REFERENCES funcionarios(id_funcionario) ON DELETE RESTRICT,

  -- Período
  anio INTEGER NOT NULL, -- Año al que corresponden estas vacaciones

  -- Días
  dias_totales INTEGER NOT NULL DEFAULT 30, -- Días que corresponden por año (default 30)
  dias_tomados INTEGER NOT NULL DEFAULT 0,  -- Días ya tomados
  dias_pendientes INTEGER GENERATED ALWAYS AS (dias_totales - dias_tomados) STORED,

  -- Estado
  activo BOOLEAN DEFAULT true NOT NULL,

  -- Metadatos
  notas TEXT, -- Observaciones
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,

  -- Constraint: Un registro por funcionario por año
  UNIQUE(funcionario_id, anio)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_vacaciones_funcionario ON vacaciones(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_vacaciones_anio ON vacaciones(anio);
CREATE INDEX IF NOT EXISTS idx_vacaciones_activo ON vacaciones(activo);

-- Comentarios
COMMENT ON TABLE vacaciones IS 'Registro de vacaciones por funcionario por año';
COMMENT ON COLUMN vacaciones.dias_pendientes IS 'Calculado automáticamente: dias_totales - dias_tomados';

-- =====================================================

-- TRIGGER: Actualizar updated_at automáticamente
CREATE TRIGGER trigger_update_vacaciones_updated_at
  BEFORE UPDATE ON vacaciones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================

-- TABLA: vacaciones_detalle (Opcional - para registro histórico)
-- Cada vez que se toman vacaciones, se registra aquí
CREATE TABLE IF NOT EXISTS vacaciones_detalle (
  id_detalle SERIAL PRIMARY KEY,
  vacacion_id INTEGER NOT NULL REFERENCES vacaciones(id_vacacion) ON DELETE CASCADE,

  -- Fechas
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  dias_tomados INTEGER NOT NULL,

  -- Estado
  estado VARCHAR(20) DEFAULT 'aprobado' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),

  -- Metadata
  motivo TEXT,
  aprobado_por INTEGER REFERENCES funcionarios(id_funcionario),
  fecha_aprobacion TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vacaciones_detalle_vacacion ON vacaciones_detalle(vacacion_id);
CREATE INDEX IF NOT EXISTS idx_vacaciones_detalle_estado ON vacaciones_detalle(estado);

COMMENT ON TABLE vacaciones_detalle IS 'Registro histórico de períodos de vacaciones tomados';

-- =====================================================

-- DATOS DE EJEMPLO RIMEC (48 funcionarios con vacaciones 2026)
-- Descomenta si quieres insertar datos de prueba después de importar funcionarios:

/*
INSERT INTO vacaciones (funcionario_id, anio, dias_totales, dias_tomados)
SELECT
  id_funcionario,
  2026,
  30, -- 30 días anuales por defecto
  FLOOR(RANDOM() * 15)::INTEGER -- Días tomados aleatorios (0-15)
FROM funcionarios
WHERE ente_id = 1 AND activo = true
ON CONFLICT (funcionario_id, anio) DO NOTHING;
*/

-- =====================================================

-- VISTA: vacaciones_funcionarios
-- Join de vacaciones con datos completos de funcionario
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

COMMENT ON VIEW vacaciones_funcionarios IS 'Vista completa de vacaciones con datos del funcionario';

-- =====================================================

-- QUERY DE PRUEBA
SELECT
  nombre_completo,
  ci,
  ente_nombre,
  departamento,
  dias_totales,
  dias_tomados,
  dias_pendientes
FROM vacaciones_funcionarios
WHERE anio = 2026
ORDER BY dias_pendientes DESC
LIMIT 10;

-- =====================================================
-- FIN EXTENSIÓN VACACIONES
-- =====================================================
