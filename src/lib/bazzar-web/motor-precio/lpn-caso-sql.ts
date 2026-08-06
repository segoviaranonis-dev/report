/**
 * Resuelve LPN + caso para ingresos ALM_WEB.
 *
 * Orden de prioridad CASO:
 * 1) PP clásico: precio_lista.nombre_caso_aplicado (BCL / evento IC)
 * 2) DPE triunvirato: v_stock_pe_rimec.cadena_comercial (COD.GRUPO) — Ley 2.3.1.10.1.2.1
 * 3) PE / FI: descp_caso_snapshot o mapa BCL-like en snapshot (no etiqueta "PE · sdrm…")
 * 4) Stock Sano
 * 5) DEFAULT
 *
 * Lección 2026-08-01: FID PE con ppd huérfano → LPN desde fid.precio_lista.
 * Lección 2026-08-06: CASO quedaba DEFAULT porque fi.caso = "PE · sdrm…" ≠ DPE.
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
    /* DPE — COD.GRUPO · etiqueta RIMEC CASO = NORMAL (nunca REGULAR en UI) */
    SELECT
      CASE UPPER(NULLIF(btrim(v.cadena_comercial), ''))
        WHEN 'PROMOCIONAL' THEN 'PROMOCIONAL'
        WHEN 'LIQUIDACION' THEN 'LIQUIDACION'
        WHEN 'COMUN' THEN 'COMUN'
        WHEN 'NORMAL' THEN 'NORMAL'
        WHEN 'REGULAR' THEN 'NORMAL'
        ELSE NULL
      END AS cadena_dpe,
      NULLIF(btrim(v.cod_grupo::text), '') AS cod_grupo
    FROM v_stock_pe_rimec v
    WHERE v.linea_codigo::text = l.codigo_proveedor::text
      AND v.referencia_codigo::text = r.codigo_proveedor::text
      AND NULLIF(btrim(v.cod_grupo::text), '') IS NOT NULL
    ORDER BY
      CASE UPPER(NULLIF(btrim(v.cadena_comercial), ''))
        WHEN 'PROMOCIONAL' THEN 0
        WHEN 'LIQUIDACION' THEN 1
        WHEN 'COMUN' THEN 2
        ELSE 3
      END,
      COALESCE(v.saldo_pares, v.cantidad_pares, 0) DESC NULLS LAST
    LIMIT 1
  ) dpe ON true
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(ppd.precio_lpn, ppd.unit_fob_ajustado, fid.precio_lista)::numeric AS lpn,
      COALESCE(
        NULLIF(btrim(ppd.descp_caso_snapshot), ''),
        CASE
          WHEN UPPER(COALESCE(fid.linea_snapshot->>'caso', fi.caso, '')) LIKE '%CARTERAS%' THEN 'CARTERAS'
          WHEN UPPER(COALESCE(fid.linea_snapshot->>'caso', fi.caso, '')) LIKE '%PROMOCIONAL%' THEN 'PROMOCIONAL'
          WHEN UPPER(COALESCE(fid.linea_snapshot->>'caso', fi.caso, '')) LIKE '%CHINELO%' THEN 'CHINELO'
          WHEN UPPER(COALESCE(fid.linea_snapshot->>'caso', fi.caso, '')) LIKE '%ACT-BRSPORT%' THEN 'ACT-BRSPORT'
          WHEN UPPER(COALESCE(fid.linea_snapshot->>'caso', fi.caso, '')) LIKE '%BR-VZ%' THEN 'BR-VZ-MD-ML-MKA-O'
          WHEN UPPER(COALESCE(fid.linea_snapshot->>'caso', fi.caso, '')) LIKE '%LIQUIDACION%' THEN 'LIQUIDACION'
          WHEN UPPER(COALESCE(fid.linea_snapshot->>'caso', fi.caso, '')) LIKE '%COMUN%' THEN 'COMUN'
          WHEN UPPER(COALESCE(fid.linea_snapshot->>'caso', fi.caso, '')) LIKE '%NORMAL%' THEN 'NORMAL'
          WHEN UPPER(COALESCE(fid.linea_snapshot->>'caso', fi.caso, '')) LIKE '%REGULAR%' THEN 'NORMAL'
          ELSE NULL
        END
      ) AS caso_precio
    FROM factura_interna fi
    JOIN factura_interna_detalle fid ON fid.factura_id = fi.id
    LEFT JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
    WHERE fi.nro_factura = tr.documento_ref
      AND (
        (
          (fid.linea_snapshot->>'linea_codigo') = l.codigo_proveedor::text
          AND (fid.linea_snapshot->>'ref_codigo') = r.codigo_proveedor::text
        )
        OR (
          ppd.id IS NOT NULL
          AND ppd.linea = l.codigo_proveedor::text
          AND ppd.referencia = r.codigo_proveedor::text
          AND (
            c.material_id IS NULL
            OR NULLIF(btrim(ppd.descp_material), '') = NULLIF(btrim(mat.descripcion), '')
            OR ppd.descp_material = mat.codigo_proveedor::text
            OR ppd.descp_material = ('K' || l.codigo_proveedor::text)
            OR mat.codigo_proveedor::text = ppd.descp_material
          )
        )
      )
    ORDER BY
      CASE WHEN ppd.id IS NOT NULL THEN 0 ELSE 1 END,
      CASE
        WHEN ppd.id IS NOT NULL
          AND NULLIF(btrim(ppd.descp_material), '') = NULLIF(btrim(mat.descripcion), '')
        THEN 0 ELSE 1
      END,
      COALESCE(ppd.precio_lpn, fid.precio_lista) DESC NULLS LAST,
      fid.id DESC
    LIMIT 1
  ) pe_pl ON true
  LEFT JOIN LATERAL (
    SELECT
      ssd.lpn::numeric AS lpn,
      NULLIF(btrim(ssd.caso_codigo), '') AS caso_precio
    FROM stock_sano_deposito ssd
    WHERE ssd.almacen_id = m.almacen_destino_id
      AND ssd.linea_id = l.id
      AND ssd.referencia_id = r.id
      AND ssd.material_id IS NOT DISTINCT FROM c.material_id
    ORDER BY ssd.updated_at DESC NULLS LAST, ssd.id DESC
    LIMIT 1
  ) ssd_lp ON true
`;

export const LPN_CASO_SELECT = `
  COALESCE(pl.lpn, pe_pl.lpn, ssd_lp.lpn) AS lpn,
  COALESCE(
    NULLIF(btrim(pl.nombre_caso_aplicado), ''),
    dpe.cadena_dpe,
    NULLIF(btrim(pe_pl.caso_precio), ''),
    NULLIF(btrim(ssd_lp.caso_precio), ''),
    'DEFAULT'
  ) AS caso_precio
`;

/** Columnas a incluir en GROUP BY cuando se usa LPN_CASO_LATERAL_SQL */
export const LPN_CASO_GROUP_BY = `
  pl.lpn, pl.nombre_caso_aplicado, dpe.cadena_dpe, dpe.cod_grupo,
  pe_pl.lpn, pe_pl.caso_precio, ssd_lp.lpn, ssd_lp.caso_precio
`;

/**
 * Markup WEB: DPE REGULAR/LIQUIDACION/COMUN → regla homónima o DEFAULT.
 * PROMOCIONAL y casos BCL (CARTERAS…) usan su propia regla.
 */
export function casoMarkupWebSql(casoExpr: string): string {
  return `
    CASE UPPER(TRIM(COALESCE(${casoExpr}, 'DEFAULT')))
      WHEN 'PROMOCIONAL' THEN 'PROMOCIONAL'
      WHEN 'CARTERAS' THEN 'CARTERAS'
      WHEN 'CHINELO' THEN 'CHINELO'
      WHEN 'ACT-BRSPORT' THEN 'ACT-BRSPORT'
      WHEN 'BR-VZ-MD-ML-MKA-O' THEN 'BR-VZ-MD-ML-MKA-O'
      WHEN 'NORMAL' THEN 'NORMAL'
      WHEN 'REGULAR' THEN 'NORMAL'
      WHEN 'LIQUIDACION' THEN 'LIQUIDACION'
      WHEN 'COMUN' THEN 'COMUN'
      ELSE 'DEFAULT'
    END
  `;
}
