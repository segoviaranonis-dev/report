-- =====================================================
-- AGREGAR JERARQUÍA ORGANIZACIONAL A FUNCIONARIOS
-- Sistema de categorías tipo plan de cuentas contable
-- =====================================================

-- Agregar columna para jerarquía organizacional
ALTER TABLE funcionarios
ADD COLUMN IF NOT EXISTS jerarquia_organizacional TEXT;

-- Crear índice para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_funcionarios_jerarquia
ON funcionarios(jerarquia_organizacional);

COMMENT ON COLUMN funcionarios.jerarquia_organizacional IS
'Jerarquía tipo plan de cuentas: 1 = jefe, 1.1 = segundo, 1.1.1 = subordinado del segundo, etc.';

-- Ejemplos de asignación para LOGISTICA
-- Jefe de departamento
UPDATE funcionarios
SET jerarquia_organizacional = '1'
WHERE ci = '3178248' AND departamento = 'LOGISTICA';  -- EVERT RUBEN GONZALEZ SERVIAN

-- Segundos al mando
UPDATE funcionarios
SET jerarquia_organizacional = '1.1'
WHERE ci = '5031163' AND departamento = 'LOGISTICA';  -- DIEGO MANUEL ACOSTA BAEZ

UPDATE funcionarios
SET jerarquia_organizacional = '1.2'
WHERE ci = '3491532' AND departamento = 'LOGISTICA';  -- FRANCISCO JAVIER ROTELA GONZALEZ

-- Subordinados del segundo (1.1)
UPDATE funcionarios
SET jerarquia_organizacional = '1.1.1'
WHERE ci = '2266046' AND departamento = 'LOGISTICA';  -- ARIEL GUSTAVO MARTINEZ

UPDATE funcionarios
SET jerarquia_organizacional = '1.1.2'
WHERE ci = '7164147' AND departamento = 'LOGISTICA';  -- GERARDO DOMINGUEZ RIVEROS

-- Subordinados del tercero (1.2)
UPDATE funcionarios
SET jerarquia_organizacional = '1.2.1'
WHERE ci = '3525689' AND departamento = 'LOGISTICA';  -- IGNACIO DOMINGUEZ RIVEROS

-- Resto sin jerarquía específica (auxiliares)
UPDATE funcionarios
SET jerarquia_organizacional = '2'
WHERE departamento = 'LOGISTICA'
AND jerarquia_organizacional IS NULL;

-- Verificar
SELECT
  departamento,
  jerarquia_organizacional,
  nombre_completo,
  cargo,
  ci
FROM funcionarios
WHERE departamento = 'LOGISTICA'
ORDER BY jerarquia_organizacional NULLS LAST, nombre_completo;
