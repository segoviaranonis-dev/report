-- ============================================================================
-- VERIFICACIÓN: Adultos NO deben tener marcas de Niños (Molekinha/Molekinho)
-- ============================================================================

-- 1. Verificar que cliente_id 2100 (Fernando Adultos) NO tiene Molekinha/Molekinho
SELECT
  COUNT(*) AS total_registros_adultos,
  COUNT(*) FILTER (WHERE marca_id IN (5, 6)) AS molekinha_molekinho_en_adultos,
  COUNT(*) FILTER (WHERE marca_id NOT IN (5, 6)) AS otras_marcas
FROM public.registro_st_vt_rc_reposicion
WHERE cliente_id = 2100
  AND lower(btrim(tipo_movimiento)) = 'stock';

-- Resultado esperado:
-- total_registros_adultos: X (cantidad total)
-- molekinha_molekinho_en_adultos: 0 ← DEBE SER CERO
-- otras_marcas: X (mismo que total)

-- ============================================================================

-- 2. Ver qué marcas tiene cliente_id 2100 (Fernando Adultos)
SELECT
  m.id_marca,
  m.descp_marca AS marca,
  COUNT(*) AS registros,
  SUM(cantidad) AS pares
FROM public.registro_st_vt_rc_reposicion r
LEFT JOIN public.marca_v2 m ON m.id_marca = r.marca_id
WHERE r.cliente_id = 2100
  AND lower(btrim(r.tipo_movimiento)) = 'stock'
GROUP BY m.id_marca, m.descp_marca
ORDER BY pares DESC;

-- Resultado esperado: NO debe aparecer MOLEKINHA ni MOLEKINHO

-- ============================================================================

-- 3. Verificar que cliente_id 2900 (Fernando Niños) SOLO tiene Molekinha/Molekinho
SELECT
  COUNT(*) AS total_registros_ninos,
  COUNT(*) FILTER (WHERE marca_id IN (5, 6)) AS molekinha_molekinho,
  COUNT(*) FILTER (WHERE marca_id NOT IN (5, 6)) AS otras_marcas_en_ninos
FROM public.registro_st_vt_rc_reposicion
WHERE cliente_id = 2900
  AND lower(btrim(tipo_movimiento)) = 'stock';

-- Resultado esperado:
-- total_registros_ninos: X
-- molekinha_molekinho: X (mismo que total) ← TODOS deben ser Molekinha/Molekinho
-- otras_marcas_en_ninos: 0 ← DEBE SER CERO

-- ============================================================================

-- 4. Resumen de los 6 depósitos
SELECT
  r.cliente_id,
  CASE
    WHEN r.cliente_id = 2100 THEN 'Fernando Adultos'
    WHEN r.cliente_id = 2900 THEN 'Fernando Niños'
    WHEN r.cliente_id = 2400 THEN 'San Martin Adultos'
    WHEN r.cliente_id = 2700 THEN 'San Martin Niños'
    WHEN r.cliente_id = 3100 THEN 'Palma Adultos'
    WHEN r.cliente_id = 3200 THEN 'Palma Niños'
    ELSE 'Otros'
  END AS deposito,
  COUNT(*) AS total_registros,
  SUM(cantidad) AS total_pares,
  COUNT(*) FILTER (WHERE marca_id IN (5, 6)) AS registros_ninos,
  COUNT(*) FILTER (WHERE marca_id NOT IN (5, 6)) AS registros_adultos
FROM public.registro_st_vt_rc_reposicion r
WHERE r.tipo_movimiento = 'stock'
  AND r.cliente_id IS NOT NULL
GROUP BY r.cliente_id
ORDER BY r.cliente_id;

-- Resultado esperado:
-- Adultos (2100, 2400, 3100): registros_ninos = 0, registros_adultos = total
-- Niños (2900, 2700, 3200): registros_ninos = total, registros_adultos = 0

-- ============================================================================
-- SI ALGUNA VERIFICACIÓN FALLA, LA DERIVACIÓN cliente_id ESTÁ MAL
-- ============================================================================
