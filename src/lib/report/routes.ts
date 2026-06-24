/** Rutas canónicas Report — Proceso importación (2.3.1.7) */

export const PROCESO_IMPORTACION = "/proceso-importacion";
export const MOTOR_PRECIOS = `${PROCESO_IMPORTACION}/motor-precios`;
export const MOTOR_BIBLIOTECA = `${MOTOR_PRECIOS}/biblioteca`;
export const MOTOR_BIBLIOTECA_NUEVA = `${MOTOR_BIBLIOTECA}/nueva`;
/** Corazón 2 — hijo de 2.3.1.7.1 Motor de precios */
export const IMPORTACION_PRECIOS = `${MOTOR_PRECIOS}/importacion-precios`;
export const IMPORTACION_PRECIOS_NUEVO = `${IMPORTACION_PRECIOS}/nuevo`;
export const IMPORTACION_PRECIOS_HISTORIAL = `${IMPORTACION_PRECIOS}/historial`;
export const INTENCION_COMPRA = `${PROCESO_IMPORTACION}/intencion-compra`;
export const INTENCION_COMPRA_BANDEJA = `${INTENCION_COMPRA}/bandeja`;
export const INTENCION_COMPRA_NUEVA = `${INTENCION_COMPRA}/nueva`;
export const DIGITACION = `${PROCESO_IMPORTACION}/digitacion`;
export const PEDIDO_PROVEEDOR = `${PROCESO_IMPORTACION}/pedido-proveedor`;
export const PEDIDO_PROVEEDOR_NUEVO = `${PEDIDO_PROVEEDOR}/nuevo`;

/** Módulos RIMEC hermanos de proceso-importación (2.3.1.8–2.3.1.10) */
export const COMPRA_LEGAL = "/compra-legal";
export const FACTURACION = "/facturacion";
export const DEPOSITO_RIMEC = "/deposito-rimec";

export function digitacionAsignar(icId: number | string): string {
  return `${DIGITACION}/asignar/${icId}`;
}

export type PpDetalleTab = "ics" | "stock" | "fi";

export function pedidoProveedorDetalle(ppId: number | string, tab?: PpDetalleTab): string {
  const base = `${PEDIDO_PROVEEDOR}/${ppId}`;
  return tab ? `${base}?tab=${tab}` : base;
}

export function compraLegalDetalle(clId: number | string): string {
  return `${COMPRA_LEGAL}/${clId}`;
}

export function facturacionDetalle(nro: string): string {
  return `${FACTURACION}/${encodeURIComponent(nro)}`;
}

/** Editor de una biblioteca concreta */
export function motorBibliotecaEditor(id: number | string): string {
  return `${MOTOR_BIBLIOTECA}/${id}`;
}

/** Legacy `/motor-precios` → redirige en middleware */
export const MOTOR_PRECIOS_LEGACY = "/motor-precios";
