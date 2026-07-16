/** FI Pronta entrega — pp_id NULL o nro PE-* (sin listado PP tránsito). */
export const SQL_WHERE_FI_PRONTA_ENTREGA = `
  (fi.pp_id IS NULL OR TRIM(COALESCE(fi.nro_factura, '')) LIKE 'PE-%')
`;

/** Resuelve LP/LPC desde precio_lista del evento ICP del PP, con fallback a snapshot PPD. */
export function sqlPrecioBaseFiDetalle(listaTierParam: string): string {
  return `
    COALESCE(
      CASE ${listaTierParam}::int
        WHEN 2 THEN pl_fk.lpc02
        WHEN 3 THEN pl_fk.lpc03
        WHEN 4 THEN pl_fk.lpc04
        ELSE pl_fk.lpn
      END,
      CASE ${listaTierParam}::int
        WHEN 2 THEN pl_cod.lpc02
        WHEN 3 THEN pl_cod.lpc03
        WHEN 4 THEN pl_cod.lpc04
        ELSE pl_cod.lpn
      END,
      CASE ${listaTierParam}::int
        WHEN 2 THEN ppd.precio_lpc02
        WHEN 3 THEN ppd.precio_lpc03
        WHEN 4 THEN ppd.precio_lpc04
        ELSE ppd.precio_lpn
      END
    )
  `;
}

/**
 * Precio base por línea: listado PP (CP) o precio_unit ya grabado en FI PE (MIG-141/160).
 */
export function sqlPrecioBaseFiDetalleConFallbackPe(listaTierParam: string): string {
  return `
    COALESCE(
      ${sqlPrecioBaseFiDetalle(listaTierParam)},
      CASE WHEN ${SQL_WHERE_FI_PRONTA_ENTREGA} THEN fid.precio_unit ELSE NULL END
    )
  `;
}

export const SQL_FROM_FI_DETALLE_PRECIO = `
  FROM public.factura_interna_detalle fid
  JOIN public.factura_interna fi ON fi.id = fid.factura_id
  LEFT JOIN public.pedido_proveedor pp ON pp.id = fi.pp_id
  LEFT JOIN public.pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
  LEFT JOIN LATERAL (
    SELECT icp.precio_evento_id
    FROM public.intencion_compra_pedido icp
    WHERE icp.pedido_proveedor_id = fi.pp_id
      AND icp.precio_evento_id IS NOT NULL
    ORDER BY icp.id
    LIMIT 1
  ) icp ON TRUE
  LEFT JOIN public.material m
    ON m.proveedor_id = pp.proveedor_importacion_id
   AND m.codigo_proveedor::text = ppd.material_code
  LEFT JOIN public.linea l
    ON l.proveedor_id = pp.proveedor_importacion_id
   AND l.codigo_proveedor::text = ppd.linea
  LEFT JOIN public.referencia ref
    ON ref.codigo_proveedor::text = ppd.referencia
   AND ref.linea_id = l.id
  LEFT JOIN public.precio_lista pl_fk
    ON pl_fk.evento_id = icp.precio_evento_id
   AND pl_fk.linea_id = l.id
   AND pl_fk.referencia_id = ref.id
   AND pl_fk.material_id = m.id
  LEFT JOIN LATERAL (
    SELECT pl.lpn, pl.lpc02, pl.lpc03, pl.lpc04, pl.fob_ajustado, pl.indice_aplicado
    FROM public.precio_lista pl
    WHERE pl.evento_id = icp.precio_evento_id
      AND TRIM(pl.linea_codigo) = TRIM(ppd.linea)
      AND TRIM(pl.referencia_codigo) = TRIM(ppd.referencia)
      AND pl.material_id = m.id
      AND pl.lpn IS NOT NULL
    ORDER BY pl.id
    LIMIT 1
  ) pl_cod ON TRUE
`;

/** Redondeo comercial ventas: ROUND centena LPN crudo, luego tier (×1.12 LPC03). */
export function sqlPrecioComercialDesdePl(listaTierParam: string): string {
  const raw = `(COALESCE(pl_fk.fob_ajustado, pl_cod.fob_ajustado) * COALESCE(pl_fk.indice_aplicado, pl_cod.indice_aplicado))`;
  const lpnComercial = `(ROUND((${raw}) / 100) * 100)`;
  return `
    CASE ${listaTierParam}::int
      WHEN 3 THEN (FLOOR((${lpnComercial} * 1.12) / 100) * 100)
      WHEN 4 THEN (FLOOR((${lpnComercial} * 1.20) / 100) * 100)
      WHEN 2 THEN ${sqlPrecioBaseFiDetalle(listaTierParam)}
      ELSE ${lpnComercial}
    END
  `;
}
