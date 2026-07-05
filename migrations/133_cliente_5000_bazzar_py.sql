-- MIG-133 — Cliente 5000: nombre canónico Bazzar.py (canal web)
-- Director 2026-07-04: reemplaza legacy "Nexus Prueba"

UPDATE cliente_v2
SET descp_cliente = 'Bazzar.py'
WHERE id_cliente = 5000
  AND descp_cliente IS DISTINCT FROM 'Bazzar.py';
