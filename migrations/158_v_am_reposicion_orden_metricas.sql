-- MIG-158 · Alejandro Magno — métricas Ordenamiento por compra previa / Programado
-- Documenta · Director 2026-07-15
--
-- Vistas canónicas para ORDER BY / ROW_NUMBER (#1 = mayor).
-- UI Report ordena en cliente sobre payload cacheado; Σ de estas vistas ≈ KPIs holding.
--
-- CP vendido: v_stock_rimec TRÁNSITO · categoría IC/PP = 2 (Compra previa)
-- Programado: PPD · categoría = 3 · (vendido si >0, si no cantidad_inicial)

CREATE OR REPLACE VIEW v_am_reposicion_cp_vendido AS
WITH pp_cat AS (
  SELECT
    pp.id AS pp_id,
    COALESCE(
      pp.categoria_id,
      (
        SELECT ic.categoria_id
        FROM intencion_compra_pedido icp
        JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
        WHERE icp.pedido_proveedor_id = pp.id
        ORDER BY icp.id
        LIMIT 1
      )
    ) AS categoria_id
  FROM pedido_proveedor pp
)
SELECT
  v.linea_codigo AS linea,
  v.referencia_codigo AS referencia,
  v.material_code AS material,
  v.color_code AS color,
  COALESCE(SUM(COALESCE(v.pares_vendidos, 0)), 0)::bigint AS cp_vendido
FROM v_stock_rimec v
JOIN pedido_proveedor pp ON pp.id = v.pp_id
WHERE v.origen_tipo = 'TRÁNSITO_PP'
  AND (v.saldo_pares > 0 OR COALESCE(v.pares_vendidos, 0) > 0)
  AND EXISTS (
    SELECT 1 FROM pp_cat pc
    WHERE pc.pp_id = pp.id AND pc.categoria_id = 2
  )
GROUP BY 1, 2, 3, 4;

CREATE OR REPLACE VIEW v_am_reposicion_programado AS
WITH pp_cat AS (
  SELECT
    pp.id AS pp_id,
    COALESCE(
      pp.categoria_id,
      (
        SELECT ic.categoria_id
        FROM intencion_compra_pedido icp
        JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
        WHERE icp.pedido_proveedor_id = pp.id
        ORDER BY icp.id
        LIMIT 1
      )
    ) AS categoria_id
  FROM pedido_proveedor pp
),
ppd_vend AS (
  SELECT
    ppd.id,
    ppd.pedido_proveedor_id,
    COALESCE(ppd.linea, '') AS linea,
    COALESCE(ppd.referencia, '') AS referencia,
    COALESCE(ppd.material_code, '0') AS material,
    COALESCE(ppd.color_code, '0') AS color,
    COALESCE(ppd.cantidad_pares, 0) AS cantidad_inicial,
    GREATEST(
      COALESCE(ppd.pares_vendidos, 0),
      COALESCE((
        SELECT SUM(vt.cantidad_vendida)
        FROM venta_transito vt
        WHERE vt.pedido_proveedor_detalle_id = ppd.id
      ), 0)
    ) AS pares_vendidos
  FROM pedido_proveedor_detalle ppd
  JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
  WHERE ppd.linea IS NOT NULL
    AND ppd.referencia IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM pp_cat pc
      WHERE pc.pp_id = pp.id AND pc.categoria_id = 3
    )
)
SELECT
  linea,
  referencia,
  material,
  color,
  COALESCE(
    SUM(
      CASE
        WHEN pares_vendidos > 0 THEN pares_vendidos
        ELSE cantidad_inicial
      END
    ),
    0
  )::bigint AS programado
FROM ppd_vend
WHERE pares_vendidos > 0
   OR GREATEST(0, cantidad_inicial - pares_vendidos) > 0
GROUP BY 1, 2, 3, 4;

CREATE OR REPLACE VIEW v_am_reposicion_orden_metricas AS
SELECT
  COALESCE(c.linea, p.linea) AS linea,
  COALESCE(c.referencia, p.referencia) AS referencia,
  COALESCE(c.material, p.material) AS material,
  COALESCE(c.color, p.color) AS color,
  COALESCE(c.cp_vendido, 0)::bigint AS cp_vendido,
  COALESCE(p.programado, 0)::bigint AS programado,
  ROW_NUMBER() OVER (
    ORDER BY
      COALESCE(c.cp_vendido, 0) DESC,
      COALESCE(c.linea, p.linea),
      COALESCE(c.referencia, p.referencia),
      COALESCE(c.material, p.material),
      COALESCE(c.color, p.color)
  ) AS rank_cp_vendido,
  ROW_NUMBER() OVER (
    ORDER BY
      COALESCE(p.programado, 0) DESC,
      COALESCE(c.linea, p.linea),
      COALESCE(c.referencia, p.referencia),
      COALESCE(c.material, p.material),
      COALESCE(c.color, p.color)
  ) AS rank_programado
FROM v_am_reposicion_cp_vendido c
FULL OUTER JOIN v_am_reposicion_programado p
  ON c.linea = p.linea
 AND c.referencia = p.referencia
 AND c.material = p.material
 AND c.color = p.color;

COMMENT ON VIEW v_am_reposicion_orden_metricas IS
  'AM Ordenamiento: rank_cp_vendido #1=mayor CP vendido; SUM(cp_vendido)≈KPI Vendido CP; SUM(programado)≈KPI Programado.';
