/**
 * Discriminador bandejas Facturación — gemelo Depósito RIMEC.
 * PE: nro PE-% o PP del universo Pronta entrega (MIG-173 · sin huérfanas pp_id NULL).
 */
export type OrigenFacturacion = "transito" | "pronta-entrega";

export type OrigenStockCanon = "PROCESO_PP" | "STOCK_IMPORTADO";

/**
 * FI de Pronta entrega.
 * Post-MIG-173: NO usar `pp_id IS NULL` (mezclaba huérfanas no-PE).
 */
export const SQL_FI_ES_PE = `
  (
    TRIM(COALESCE(fi.nro_factura, '')) LIKE 'PE-%'
    OR EXISTS (
      SELECT 1
      FROM pedido_proveedor pp_pe
      JOIN quincena_arribo qa_pe ON qa_pe.id = pp_pe.quincena_arribo_id
      WHERE pp_pe.id = fi.pp_id
        AND pp_pe.entidad_comercial = 'STOCK'
        AND pp_pe.deposito_codigo IS NOT NULL
        AND lower(trim(qa_pe.descripcion)) = lower('Pronta entrega')
    )
  )
`;

/** FI de proceso / tránsito (excluye PE). */
export const SQL_FI_ES_TRANSITO = `
  fi.pp_id IS NOT NULL
  AND TRIM(COALESCE(fi.nro_factura, '')) NOT LIKE 'PE-%'
  AND NOT EXISTS (
    SELECT 1
    FROM pedido_proveedor pp_pe
    JOIN quincena_arribo qa_pe ON qa_pe.id = pp_pe.quincena_arribo_id
    WHERE pp_pe.id = fi.pp_id
      AND pp_pe.entidad_comercial = 'STOCK'
      AND pp_pe.deposito_codigo IS NOT NULL
      AND lower(trim(qa_pe.descripcion)) = lower('Pronta entrega')
  )
`;
