-- ============================================================================
-- TEST: Verificar que el traductor cliente_id → ente funciona correctamente
-- ============================================================================

-- 1. Totales por ente (mismo resultado que antes, pero con cliente_id)
SELECT
  CASE
    WHEN cliente_id IN (2100, 2900) THEN 'Fernando'
    WHEN cliente_id IN (2400, 2700) THEN 'San Martín'
    WHEN cliente_id IN (3100, 3200) THEN 'Palma'
    WHEN cliente_id IS NULL THEN 'RIMEC'
    ELSE 'Otros'
  END AS ente,
  COUNT(*) AS registros,
  SUM(CASE WHEN lower(btrim(tipo_movimiento)) = 'stock' THEN cantidad ELSE 0 END) AS stock,
  SUM(CASE WHEN lower(btrim(tipo_movimiento)) = 'venta' THEN cantidad ELSE 0 END) AS venta
FROM public.registro_st_vt_rc_reposicion
GROUP BY ente
ORDER BY ente;

-- 2. Detalle por cliente_id (granularidad interna)
SELECT
  cliente_id,
  CASE
    WHEN cliente_id = 2100 THEN 'Fernando Adultos'
    WHEN cliente_id = 2900 THEN 'Fernando Niños'
    WHEN cliente_id = 2400 THEN 'San Martin Adultos'
    WHEN cliente_id = 2700 THEN 'San Martin Niños'
    WHEN cliente_id = 3100 THEN 'Palma Adultos'
    WHEN cliente_id = 3200 THEN 'Palma Niños'
    WHEN cliente_id IS NULL THEN 'RIMEC'
    ELSE 'Desconocido'
  END AS detalle,
  COUNT(*) AS registros,
  SUM(CASE WHEN lower(btrim(tipo_movimiento)) = 'stock' THEN cantidad ELSE 0 END) AS stock,
  SUM(CASE WHEN lower(btrim(tipo_movimiento)) = 'venta' THEN cantidad ELSE 0 END) AS venta
FROM public.registro_st_vt_rc_reposicion
GROUP BY cliente_id
ORDER BY cliente_id NULLS LAST;

-- 3. Comparación: ente agrupado vs detalle granular
WITH ente_totales AS (
  SELECT
    CASE
      WHEN cliente_id IN (2100, 2900) THEN 'Fernando'
      WHEN cliente_id IN (2400, 2700) THEN 'San Martín'
      WHEN cliente_id IN (3100, 3200) THEN 'Palma'
      WHEN cliente_id IS NULL THEN 'RIMEC'
      ELSE 'Otros'
    END AS ente,
    SUM(CASE WHEN lower(btrim(tipo_movimiento)) = 'stock' THEN cantidad ELSE 0 END) AS stock_total
  FROM public.registro_st_vt_rc_reposicion
  GROUP BY ente
),
detalle_suma AS (
  SELECT
    CASE
      WHEN cliente_id IN (2100, 2900) THEN 'Fernando'
      WHEN cliente_id IN (2400, 2700) THEN 'San Martín'
      WHEN cliente_id IN (3100, 3200) THEN 'Palma'
      WHEN cliente_id IS NULL THEN 'RIMEC'
      ELSE 'Otros'
    END AS ente,
    cliente_id,
    SUM(CASE WHEN lower(btrim(tipo_movimiento)) = 'stock' THEN cantidad ELSE 0 END) AS stock_detalle
  FROM public.registro_st_vt_rc_reposicion
  GROUP BY ente, cliente_id
)
SELECT
  et.ente,
  et.stock_total AS total_agrupado,
  SUM(ds.stock_detalle) AS total_desde_detalle,
  (et.stock_total = SUM(ds.stock_detalle)) AS coincide
FROM ente_totales et
JOIN detalle_suma ds ON ds.ente = et.ente
GROUP BY et.ente, et.stock_total
ORDER BY et.ente;

-- ============================================================================
-- Resultado esperado:
-- - Totales agrupados deben coincidir con suma de detalles
-- - Fernando = 2100 + 2900
-- - San Martín = 2400 + 2700
-- - Palma = 3100 + 3200
-- - RIMEC = NULL
-- ============================================================================
