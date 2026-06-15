-- =====================================================
-- ÍNDICES DE PERFORMANCE PARA MÓDULO RRHH
-- =====================================================
-- Optimización para queries frecuentes

-- 1. Funcionarios - búsqueda por CI y nombre
CREATE INDEX IF NOT EXISTS idx_funcionarios_ci ON funcionarios(ci);
CREATE INDEX IF NOT EXISTS idx_funcionarios_nombre_completo ON funcionarios(nombre_completo);
CREATE INDEX IF NOT EXISTS idx_funcionarios_activo_apellidos ON funcionarios(activo, apellidos, nombres);

-- 2. Funcionarios - filtros comunes
CREATE INDEX IF NOT EXISTS idx_funcionarios_departamento ON funcionarios(departamento) WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_funcionarios_cargo ON funcionarios(cargo) WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_funcionarios_ente_id ON funcionarios(ente_id) WHERE activo = true;

-- 3. Vacaciones - búsqueda por funcionario y año
CREATE INDEX IF NOT EXISTS idx_vacaciones_funcionario_anio ON vacaciones(funcionario_id, anio) WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_vacaciones_anio_activo ON vacaciones(anio, activo);

-- 4. Vacaciones detalle - búsqueda por vacacion_id
CREATE INDEX IF NOT EXISTS idx_vacaciones_detalle_vacacion_id ON vacaciones_detalle(vacacion_id);
CREATE INDEX IF NOT EXISTS idx_vacaciones_detalle_created_at ON vacaciones_detalle(created_at DESC);

-- 5. Entes - búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_entes_codigo ON entes(codigo) WHERE activo = true;

-- Análisis de tablas para actualizar estadísticas
ANALYZE funcionarios;
ANALYZE vacaciones;
ANALYZE vacaciones_detalle;
ANALYZE entes;

-- Comentarios
COMMENT ON INDEX idx_funcionarios_activo_apellidos IS 'Optimiza ORDER BY apellidos en listado principal';
COMMENT ON INDEX idx_vacaciones_funcionario_anio IS 'Optimiza JOIN con vacaciones por funcionario';
COMMENT ON INDEX idx_vacaciones_detalle_vacacion_id IS 'Optimiza carga de historial detallado';
