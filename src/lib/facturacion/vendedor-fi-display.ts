/**
 * Display vendedor en facturación.
 * PE/Web: fi.vendedor_id = usuario_v2.id_usuario (NO vendedor_v2).
 * Colisión bancaria: mismo número en ambas tablas ≠ misma persona
 * (ej. usuario 19=Guido · vendedor_v2 19=PATRICIA). Error 4.02.04.004.
 *
 * Prioridad UI: payload PVR → usuario → catálogo vendedor_v2.
 */
export const SQL_VENDEDOR_FI_DISPLAY = `
COALESCE(
  NULLIF(TRIM(pvr_vend.payload_json->>'vendedor_nombre'), ''),
  NULLIF(TRIM(vu_vend.descp_usuario), ''),
  NULLIF(TRIM(vd_vend.descp_vendedor), ''),
  '—'
)`.trim();

/** JOINs requeridos por SQL_VENDEDOR_FI_DISPLAY (alias fijos). */
export const SQL_VENDEDOR_FI_JOINS = `
LEFT JOIN pedido_venta_rimec pvr_vend ON pvr_vend.id = fi.pedido_id
LEFT JOIN usuario_v2 vu_vend ON vu_vend.id_usuario = fi.vendedor_id
LEFT JOIN vendedor_v2 vd_vend ON vd_vend.id_vendedor = fi.vendedor_id
`.trim();

export const SQL_VENDEDOR_FI_GROUP_BY = `
pvr_vend.payload_json, vu_vend.descp_usuario, vd_vend.descp_vendedor
`.trim();
