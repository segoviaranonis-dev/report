/**
 * Alejandro Magno — PE en pedido_proveedor_detalle (no staging).
 * Discriminadores canónicos en cabecera PP.
 */
export const PE_ENTIDAD_COMERCIAL = "STOCK";
export const PE_QUINCENA_DESC = "Pronta entrega";
export const PE_CATEGORIA_ID = 1;
export const PE_ESTADO_TRANSITO = "EN_DEPOSITO";

/** Alias tabla pp en queries Report PE. */
export const PE_PP = "pp";
export const PE_PPD = "ppd";

/** JOIN mínimo PP+PPD+quincena para módulo stock-pronta-entrega. */
export const PE_PPD_FROM = `
  FROM pedido_proveedor_detalle ppd
  JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
  JOIN quincena_arribo qa ON qa.id = pp.quincena_arribo_id
`;

/** WHERE saldo PE en depósito (PPD único). */
export const PE_PPD_WHERE_SALDO = `
  pp.entidad_comercial = '${PE_ENTIDAD_COMERCIAL}'
  AND pp.deposito_codigo IS NOT NULL
  AND pp.estado_transito = '${PE_ESTADO_TRANSITO}'
  AND pp.categoria_id = ${PE_CATEGORIA_ID}
  AND lower(trim(qa.descripcion)) = lower('${PE_QUINCENA_DESC}')
  AND GREATEST(0, COALESCE(ppd.cantidad_pares, 0) - COALESCE(ppd.pares_vendidos, 0)) > 0
`;

/** tipo_v2 desde proveedor importación (654 calzado · 638 confecciones). */
export const PE_TIPO_V2_EXPR = `
  CASE pp.proveedor_importacion_id
    WHEN 654 THEN 1
    WHEN 638 THEN 2
    ELSE NULL
  END
`;

export const PE_DEPOSITO_COL_EXPR = `
  CASE pp.deposito_codigo
    WHEN 'D1' THEN 'S00_D1'
    WHEN 'DEP2' THEN 'S00_DEP2'
    WHEN 'D3' THEN 'S00_D3'
    ELSE COALESCE(pp.deposito_codigo, '—')
  END
`;

export const PE_MONTO_GS_EXPR = `
  ROUND(
    GREATEST(0, COALESCE(ppd.cantidad_pares, 0) - COALESCE(ppd.pares_vendidos, 0))
    * COALESCE(ppd.unit_fob_ajustado, 0)
  )::bigint
`;

export const PE_SALDO_EXPR = `
  GREATEST(0, COALESCE(ppd.cantidad_pares, 0) - COALESCE(ppd.pares_vendidos, 0))
`;

export const PE_CODIGO_BARRAS_EXPR = `
  CONCAT(
    COALESCE(ppd.linea, ''), '.',
    COALESCE(ppd.referencia, '0'), '.',
    COALESCE(ppd.material_code, '0'), '.',
    COALESCE(ppd.color_code, '0')
  )
`;
