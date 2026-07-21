/**
 * Resuelve LPN + caso comercial para ingresos ALM_WEB:
 * 1) PP clásico: snapshot id_pp → precio_lista del evento IC
 * 2) PE / FI sin pp_id: documento_ref → factura_interna → PPD (precio_lpn + descp_caso_snapshot)
 */
export const LPN_CASO_LATERAL_SQL = `
  LEFT JOIN LATERAL (
    SELECT pl2.lpn, pl2.nombre_caso_aplicado
    FROM precio_lista pl2
    JOIN linea l2 ON l2.id = pl2.linea_id
    JOIN referencia r2 ON r2.id = pl2.referencia_id
    WHERE pl2.evento_id = icp.precio_evento_id
      AND l2.codigo_proveedor = l.codigo_proveedor
      AND r2.codigo_proveedor = r.codigo_proveedor
      AND (c.material_id IS NULL OR pl2.material_id = c.material_id)
    ORDER BY
      CASE WHEN pl2.linea_id = l.id AND pl2.referencia_id = r.id THEN 0 ELSE 1 END,
      pl2.id DESC
    LIMIT 1
  ) pl ON true
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(ppd.precio_lpn, ppd.unit_fob_ajustado)::numeric AS lpn,
      COALESCE(NULLIF(btrim(ppd.descp_caso_snapshot), ''), 'DEFAULT') AS caso_precio
    FROM factura_interna fi
    JOIN factura_interna_detalle fid ON fid.factura_id = fi.id
    JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
    WHERE fi.nro_factura = tr.documento_ref
      AND ppd.linea = l.codigo_proveedor::text
      AND ppd.referencia = r.codigo_proveedor::text
      AND (
        c.material_id IS NULL
        OR NULLIF(btrim(ppd.descp_material), '') = NULLIF(btrim(mat.descripcion), '')
        OR ppd.descp_material = mat.codigo_proveedor::text
        OR ppd.descp_material = ('K' || l.codigo_proveedor::text)
        OR mat.codigo_proveedor::text = ppd.descp_material
      )
    ORDER BY ppd.precio_lpn DESC NULLS LAST, ppd.id DESC
    LIMIT 1
  ) pe_pl ON tr.documento_ref LIKE 'PE-%'
`;

export const LPN_CASO_SELECT = `
  COALESCE(pl.lpn, pe_pl.lpn) AS lpn,
  COALESCE(pl.nombre_caso_aplicado, pe_pl.caso_precio) AS caso_precio
`;
