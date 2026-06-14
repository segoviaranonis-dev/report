/** Gemelo control_central/modules/compra_legal/logic.py */
export const ALM_TRANSITO = 3;
export const ALM_WEB_BAZAR = 1;

/** Cliente RIMEC del canal e-commerce (Carga Manual Facturación → ALM_WEB_01) */
export const CLIENTE_WEB_BAZAR_ID = 5000;
export const CLIENTE_WEB_BAZAR_CODIGO = "5000";

/**
 * Solo traspasos cuya FAC-INT es del cliente web (5000).
 * Nuevo flujo: factura_interna.cliente_id
 * Legacy: venta_transito.codigo_cliente
 */
export const SQL_WHERE_TRASPASO_CLIENTE_WEB = `
  AND (
    EXISTS (
      SELECT 1 FROM factura_interna fi
      WHERE fi.nro_factura = t.documento_ref
        AND fi.cliente_id = $CLIENTE_ID
    )
    OR EXISTS (
      SELECT 1 FROM venta_transito vt
      WHERE vt.numero_factura_interna = t.documento_ref
        AND TRIM(vt.codigo_cliente) = $CLIENTE_CODIGO
    )
  )
`;

export function bindClienteWebParams(base: unknown[]): { sql: string; params: unknown[] } {
  const idIdx = base.length + 1;
  const codIdx = base.length + 2;
  return {
    sql: SQL_WHERE_TRASPASO_CLIENTE_WEB.replace("$CLIENTE_ID", `$${idIdx}`).replace(
      "$CLIENTE_CODIGO",
      `$${codIdx}`,
    ),
    params: [...base, CLIENTE_WEB_BAZAR_ID, CLIENTE_WEB_BAZAR_CODIGO],
  };
}
export const ESTADO_COLOR: Record<string, string> = {
  BORRADOR: "#64748B",
  ENVIADO: "#F59E0B",
  CONFIRMADO: "#22C55E",
};

export const ESTADO_LABEL: Record<string, string> = {
  BORRADOR: "En Tránsito",
  ENVIADO: "Listo p/ Recibir",
  CONFIRMADO: "Recibido",
};

export const ESTADO_FILTER_OPTIONS = ["TODOS", "ENVIADO", "CONFIRMADO", "BORRADOR"] as const;

export type EstadoFilter = (typeof ESTADO_FILTER_OPTIONS)[number];
