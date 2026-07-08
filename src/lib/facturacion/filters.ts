/**
 * Discriminador bandejas Facturación — gemelo Depósito RIMEC.
 * PE: BD actual sin ppd.quincena_desc (columna futura Alejandro Magno).
 */
export type OrigenFacturacion = "transito" | "pronta-entrega";

export type OrigenStockCanon = "PROCESO_PP" | "STOCK_IMPORTADO";

/** FI de Pronta entrega (puente dev + destino PPD). */
export const SQL_FI_ES_PE = `
  (
    fi.nro_factura LIKE 'PE-%'
    OR fi.pp_id IS NULL
  )
`;

/** FI de proceso / tránsito (excluye PE). */
export const SQL_FI_ES_TRANSITO = `
  fi.pp_id IS NOT NULL
  AND fi.nro_factura NOT LIKE 'PE-%'
`;
