-- MIG-146 — IC PROGRAMADO proforma 8604 · imponer LPC04 (Director · 2026-07-07)
-- Copia canónica: control_central/migrations/146_ic_programado_8604_lpc04.sql

BEGIN;

UPDATE intencion_compra ic
SET listado_precio_id = 4
WHERE ic.categoria_id = 3
  AND ic.numero_registro IN (
    'IC-2026-0060', 'IC-2026-0061', 'IC-2026-0062', 'IC-2026-0063', 'IC-2026-0064',
    'IC-2026-0065', 'IC-2026-0066', 'IC-2026-0067', 'IC-2026-0068', 'IC-2026-0069'
  );

UPDATE intencion_compra ic
SET listado_precio_id = 4
FROM intencion_compra_pedido icp
JOIN pedido_proveedor pp ON pp.id = icp.pedido_proveedor_id
WHERE icp.intencion_compra_id = ic.id
  AND ic.categoria_id = 3
  AND (
    COALESCE(pp.numero_proforma, '') ILIKE '%8604%'
    OR COALESCE(pp.numero_registro, '') ILIKE '%8604%'
  );

UPDATE factura_interna fi
SET lista_precio_id = 4
FROM intencion_compra ic
JOIN intencion_compra_pedido icp ON icp.intencion_compra_id = ic.id
WHERE fi.pp_id = icp.pedido_proveedor_id
  AND fi.cliente_id = ic.id_cliente
  AND ic.categoria_id = 3
  AND ic.listado_precio_id = 4
  AND fi.estado IN ('RESERVADA', 'CONFIRMADA');

COMMIT;
