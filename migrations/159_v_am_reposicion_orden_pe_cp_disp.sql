-- MIG-159 · AM — orden En stock PE + En tránsito CP disp. (enteros bigint)
-- DROP + recreate (CREATE OR REPLACE no puede reordenar columnas)

DROP VIEW IF EXISTS v_am_reposicion_orden_metricas CASCADE;

CREATE OR REPLACE VIEW v_am_reposicion_pe_disponible AS
SELECT
  COALESCE(ppd.linea, '') AS linea,
  COALESCE(ppd.referencia, '') AS referencia,
  COALESCE(ppd.material_code, '0') AS material,
  COALESCE(ppd.color_code, '0') AS color,
  COALESCE(
    SUM(GREATEST(0, COALESCE(ppd.cantidad_pares, 0) - COALESCE(ppd.pares_vendidos, 0))),
    0
  )::bigint AS pe_disponible
FROM pedido_proveedor_detalle ppd
JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
JOIN quincena_arribo qa ON qa.id = pp.quincena_arribo_id
WHERE pp.entidad_comercial = 'STOCK'
  AND pp.deposito_codigo IS NOT NULL
  AND pp.estado_transito = 'EN_DEPOSITO'
  AND pp.categoria_id = 1
  AND lower(trim(qa.descripcion)) = lower('Pronta entrega')
  AND (
    GREATEST(0, COALESCE(ppd.cantidad_pares, 0) - COALESCE(ppd.pares_vendidos, 0)) > 0
    OR COALESCE(ppd.pares_vendidos, 0) > 0
  )
GROUP BY 1, 2, 3, 4;

CREATE OR REPLACE VIEW v_am_reposicion_cp_disponible AS
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
  COALESCE(SUM(COALESCE(v.saldo_pares, 0)), 0)::bigint AS cp_disponible
FROM v_stock_rimec v
JOIN pedido_proveedor pp ON pp.id = v.pp_id
WHERE v.origen_tipo = 'TRÁNSITO_PP'
  AND COALESCE(v.saldo_pares, 0) > 0
  AND EXISTS (
    SELECT 1 FROM pp_cat pc
    WHERE pc.pp_id = pp.id AND pc.categoria_id = 2
  )
GROUP BY 1, 2, 3, 4;

-- Reafirmar hijas de MIG-158 (por si DROP CASCADE las tocó)
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

CREATE VIEW v_am_reposicion_orden_metricas AS
SELECT
  COALESCE(pe.linea, cp.linea, c.linea, p.linea) AS linea,
  COALESCE(pe.referencia, cp.referencia, c.referencia, p.referencia) AS referencia,
  COALESCE(pe.material, cp.material, c.material, p.material) AS material,
  COALESCE(pe.color, cp.color, c.color, p.color) AS color,
  COALESCE(pe.pe_disponible, 0)::bigint AS pe_disponible,
  COALESCE(cp.cp_disponible, 0)::bigint AS cp_disponible,
  COALESCE(c.cp_vendido, 0)::bigint AS cp_vendido,
  COALESCE(p.programado, 0)::bigint AS programado,
  ROW_NUMBER() OVER (
    ORDER BY COALESCE(pe.pe_disponible, 0) DESC,
      COALESCE(pe.linea, cp.linea, c.linea, p.linea),
      COALESCE(pe.referencia, cp.referencia, c.referencia, p.referencia),
      COALESCE(pe.material, cp.material, c.material, p.material),
      COALESCE(pe.color, cp.color, c.color, p.color)
  ) AS rank_pe_disponible,
  ROW_NUMBER() OVER (
    ORDER BY COALESCE(cp.cp_disponible, 0) DESC,
      COALESCE(pe.linea, cp.linea, c.linea, p.linea),
      COALESCE(pe.referencia, cp.referencia, c.referencia, p.referencia),
      COALESCE(pe.material, cp.material, c.material, p.material),
      COALESCE(pe.color, cp.color, c.color, p.color)
  ) AS rank_cp_disponible,
  ROW_NUMBER() OVER (
    ORDER BY COALESCE(c.cp_vendido, 0) DESC,
      COALESCE(pe.linea, cp.linea, c.linea, p.linea),
      COALESCE(pe.referencia, cp.referencia, c.referencia, p.referencia),
      COALESCE(pe.material, cp.material, c.material, p.material),
      COALESCE(pe.color, cp.color, c.color, p.color)
  ) AS rank_cp_vendido,
  ROW_NUMBER() OVER (
    ORDER BY COALESCE(p.programado, 0) DESC,
      COALESCE(pe.linea, cp.linea, c.linea, p.linea),
      COALESCE(pe.referencia, cp.referencia, c.referencia, p.referencia),
      COALESCE(pe.material, cp.material, c.material, p.material),
      COALESCE(pe.color, cp.color, c.color, p.color)
  ) AS rank_programado
FROM v_am_reposicion_pe_disponible pe
FULL OUTER JOIN v_am_reposicion_cp_disponible cp
  ON pe.linea = cp.linea AND pe.referencia = cp.referencia
 AND pe.material = cp.material AND pe.color = cp.color
FULL OUTER JOIN v_am_reposicion_cp_vendido c
  ON COALESCE(pe.linea, cp.linea) = c.linea
 AND COALESCE(pe.referencia, cp.referencia) = c.referencia
 AND COALESCE(pe.material, cp.material) = c.material
 AND COALESCE(pe.color, cp.color) = c.color
FULL OUTER JOIN v_am_reposicion_programado p
  ON COALESCE(pe.linea, cp.linea, c.linea) = p.linea
 AND COALESCE(pe.referencia, cp.referencia, c.referencia) = p.referencia
 AND COALESCE(pe.material, cp.material, c.material) = p.material
 AND COALESCE(pe.color, cp.color, c.color) = p.color;

COMMENT ON VIEW v_am_reposicion_orden_metricas IS
  'AM 4 órdenes: PE / CP disp / CP vend / Programado · ranks #1=mayor · SUM enteros = KPIs.';
