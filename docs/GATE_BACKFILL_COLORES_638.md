# Gate — Backfill colores 638 (paralelo al mapa COD.GRUPO)

**Estado:** BLOQUEADO hasta OK explícito del Director.

El mapa comercial `COD.GRUPO → pilares` (MIG-171 + `cod-grupo-decode.ts`) **no** ejecuta ni requiere el backfill de colores Kyly.

## Qué queda pendiente (stock vivo)

1. Crear filas `color` con encoding anti-colisión (`control_central/core/pilares/codigos.py`).
2. Reasignar PPD / combinación PE.
3. Corregir `descp_color` desde stem imagen / Excel.

## UI

Administrador de Pilares → panel Mapa SDRM muestra `color_backfill_gate.blocked = true`.

## Desbloqueo

Orden directa del Director en el turno (ej. «OK backfill colores 638»).
