-- =====================================================
-- MIGRACIÓN 080: Sistema Gestión Vacaciones DUAL
-- Soporte para DÍAS (regulares) + HORAS (gerentes)
-- RESET TOTAL: todos los contadores en 0 para 2026-06-15
-- =====================================================

-- 1. ELIMINAR DATOS EXISTENTES (reset total)
-- =====================================================

TRUNCATE TABLE vacaciones_detalle CASCADE;
TRUNCATE TABLE vacaciones CASCADE;

-- 2. RECREAR TABLA vacaciones CON SISTEMA DUAL
-- =====================================================

DROP TABLE IF EXISTS vacaciones CASCADE;

CREATE TABLE vacaciones (
  id_vacacion SERIAL PRIMARY KEY,
  funcionario_id INTEGER NOT NULL REFERENCES funcionarios(id_funcionario) ON DELETE RESTRICT,

  -- Año fiscal
  anio INTEGER NOT NULL,

  -- Tipo de vacación
  tipo_vacacion VARCHAR(10) NOT NULL DEFAULT 'DIAS' CHECK (tipo_vacacion IN ('DIAS', 'HORAS', 'MIXTO')),

  -- SISTEMA DÍAS (funcionarios regulares - ley paraguaya)
  dias_totales INTEGER NOT NULL DEFAULT 0,
  dias_tomados INTEGER NOT NULL DEFAULT 0,
  dias_pendientes INTEGER GENERATED ALWAYS AS (dias_totales - dias_tomados) STORED,

  -- SISTEMA HORAS (gerentes/supervisores - flexibilidad PLUS)
  horas_totales NUMERIC(8,2) NOT NULL DEFAULT 0.00,
  horas_tomadas NUMERIC(8,2) NOT NULL DEFAULT 0.00,
  horas_pendientes NUMERIC(8,2) GENERATED ALWAYS AS (horas_totales - horas_tomadas) STORED,

  -- Metadatos
  activo BOOLEAN DEFAULT true NOT NULL,
  notas TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,

  -- Un solo registro por funcionario por año
  UNIQUE(funcionario_id, anio)
);

-- Índices
CREATE INDEX idx_vacaciones_funcionario ON vacaciones(funcionario_id);
CREATE INDEX idx_vacaciones_anio ON vacaciones(anio);
CREATE INDEX idx_vacaciones_tipo ON vacaciones(tipo_vacacion);
CREATE INDEX idx_vacaciones_activo ON vacaciones(activo);

-- Comentarios
COMMENT ON TABLE vacaciones IS 'Gestión vacaciones DUAL: días (ley) + horas flexibles (gerentes)';
COMMENT ON COLUMN vacaciones.tipo_vacacion IS 'DIAS: funcionarios regulares | HORAS: gerentes con flexibilidad | MIXTO: ambos';
COMMENT ON COLUMN vacaciones.dias_totales IS 'Días según antigüedad (12/18/30 días legales)';
COMMENT ON COLUMN vacaciones.horas_totales IS 'Horas flexibles para gerentes (1 día = 8 horas)';

-- Trigger updated_at
DROP TRIGGER IF EXISTS trigger_update_vacaciones_updated_at ON vacaciones;
CREATE TRIGGER trigger_update_vacaciones_updated_at
  BEFORE UPDATE ON vacaciones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 3. RECREAR TABLA vacaciones_detalle (historial)
-- =====================================================

DROP TABLE IF EXISTS vacaciones_detalle CASCADE;

CREATE TABLE vacaciones_detalle (
  id_detalle SERIAL PRIMARY KEY,
  vacacion_id INTEGER NOT NULL REFERENCES vacaciones(id_vacacion) ON DELETE CASCADE,

  -- Período solicitado
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,

  -- Cantidad tomada
  dias_tomados INTEGER DEFAULT 0,
  horas_tomadas NUMERIC(6,2) DEFAULT 0.00,

  -- Workflow aprobación
  estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'cancelado')),
  motivo TEXT,
  aprobado_por INTEGER REFERENCES funcionarios(id_funcionario),
  fecha_aprobacion TIMESTAMP,

  -- Metadatos
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Índices
CREATE INDEX idx_vacaciones_detalle_vacacion ON vacaciones_detalle(vacacion_id);
CREATE INDEX idx_vacaciones_detalle_estado ON vacaciones_detalle(estado);
CREATE INDEX idx_vacaciones_detalle_fecha_inicio ON vacaciones_detalle(fecha_inicio);

-- Comentarios
COMMENT ON TABLE vacaciones_detalle IS 'Historial de períodos de vacaciones solicitados/aprobados';

-- Trigger updated_at
DROP TRIGGER IF EXISTS trigger_update_vacaciones_detalle_updated_at ON vacaciones_detalle;
CREATE TRIGGER trigger_update_vacaciones_detalle_updated_at
  BEFORE UPDATE ON vacaciones_detalle
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. VISTA CONSOLIDADA
-- =====================================================

CREATE OR REPLACE VIEW v_vacaciones_funcionarios AS
SELECT
  v.id_vacacion,
  v.anio,
  v.tipo_vacacion,

  -- Datos funcionario
  f.id_funcionario,
  f.nombre_completo,
  f.ci,
  f.departamento,
  f.cargo,
  f.antiguedad_anios,

  -- Datos ente
  e.nombre AS ente_nombre,

  -- Vacaciones DÍAS
  v.dias_totales,
  v.dias_tomados,
  v.dias_pendientes,

  -- Vacaciones HORAS
  v.horas_totales,
  v.horas_tomadas,
  v.horas_pendientes,

  -- % Utilización
  CASE
    WHEN v.dias_totales > 0 THEN ROUND((v.dias_tomados::NUMERIC / v.dias_totales) * 100, 1)
    ELSE 0
  END AS porcentaje_dias_usado,

  CASE
    WHEN v.horas_totales > 0 THEN ROUND((v.horas_tomadas / v.horas_totales) * 100, 1)
    ELSE 0
  END AS porcentaje_horas_usado,

  v.activo,
  v.notas
FROM vacaciones v
INNER JOIN funcionarios f ON v.funcionario_id = f.id_funcionario
INNER JOIN entes e ON f.ente_id = e.id_ente
WHERE v.activo = true
ORDER BY f.apellidos, f.nombres;

-- 5. FUNCIÓN: Calcular días legales por antigüedad
-- =====================================================

CREATE OR REPLACE FUNCTION calcular_dias_legales(antiguedad_anios INTEGER)
RETURNS INTEGER AS $$
BEGIN
  -- Ley paraguaya de vacaciones
  IF antiguedad_anios >= 10 THEN
    RETURN 30;
  ELSIF antiguedad_anios >= 5 THEN
    RETURN 18;
  ELSE
    RETURN 12;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calcular_dias_legales IS 'Calcula días de vacaciones según ley paraguaya (12/18/30 días)';

-- 6. FUNCIÓN: Inicializar vacaciones para un año
-- =====================================================

CREATE OR REPLACE FUNCTION inicializar_vacaciones_anio(p_anio INTEGER)
RETURNS TABLE(
  funcionarios_procesados INTEGER,
  registros_creados INTEGER
) AS $$
DECLARE
  v_count_total INTEGER := 0;
  v_count_insertados INTEGER := 0;
  v_rec RECORD;
  v_dias_legales INTEGER;
  v_es_gerente BOOLEAN;
  v_horas_total NUMERIC(8,2);
BEGIN
  -- Procesar todos los funcionarios activos
  FOR v_rec IN
    SELECT
      f.id_funcionario,
      f.antiguedad_anios,
      f.cargo
    FROM funcionarios f
    WHERE f.activo = true
  LOOP
    v_count_total := v_count_total + 1;

    -- Calcular días legales
    v_dias_legales := calcular_dias_legales(v_rec.antiguedad_anios);

    -- Determinar si es gerente/supervisor (tiene horas flexibles)
    v_es_gerente := (
      v_rec.cargo ILIKE '%GERENTE%' OR
      v_rec.cargo ILIKE '%SUPERVISOR%' OR
      v_rec.cargo ILIKE '%COORDINADOR%' OR
      v_rec.cargo ILIKE '%DIRECTOR%'
    );

    -- Calcular horas (1 día = 8 horas)
    IF v_es_gerente THEN
      v_horas_total := v_dias_legales * 8.0;
    ELSE
      v_horas_total := 0.00;
    END IF;

    -- Insertar registro (skip si ya existe)
    -- TODOS los funcionarios tienen sistema MIXTO (días + horas)
    INSERT INTO vacaciones (
      funcionario_id,
      anio,
      tipo_vacacion,
      dias_totales,
      dias_tomados,
      horas_totales,
      horas_tomadas
    )
    VALUES (
      v_rec.id_funcionario,
      p_anio,
      'MIXTO',  -- TODOS tienen ambos sistemas
      v_dias_legales,
      0,
      v_dias_legales * 8.0,  -- TODOS tienen horas = días × 8
      0.00
    )
    ON CONFLICT (funcionario_id, anio) DO NOTHING;

    IF FOUND THEN
      v_count_insertados := v_count_insertados + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_count_total, v_count_insertados;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION inicializar_vacaciones_anio IS 'Crea registros vacaciones para todos los funcionarios en un año específico';

-- 7. INICIALIZAR 2026 CON TODOS EN 0
-- =====================================================

-- Ejecutar inicialización para año 2026
SELECT * FROM inicializar_vacaciones_anio(2026);

-- Verificación
SELECT
  'Total registros creados' AS detalle,
  COUNT(*) AS cantidad
FROM vacaciones
WHERE anio = 2026;

-- =====================================================
-- FIN MIGRACIÓN 080
-- Fecha: 2026-06-14
-- Sistema listo para operar desde 2026-06-15
-- =====================================================
