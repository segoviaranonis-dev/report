/** Rutas canónicas Report — Proceso importación (2.3.1.7) */

export const PROCESO_IMPORTACION = "/proceso-importacion";
export const MOTOR_PRECIOS = `${PROCESO_IMPORTACION}/motor-precios`;
export const MOTOR_BIBLIOTECA = `${MOTOR_PRECIOS}/biblioteca`;
export const MOTOR_BIBLIOTECA_NUEVA = `${MOTOR_BIBLIOTECA}/nueva`;
export const IMPORTACION_PRECIOS = `${PROCESO_IMPORTACION}/importacion-precios`;
export const IMPORTACION_PRECIOS_NUEVO = `${IMPORTACION_PRECIOS}/nuevo`;

/** Editor de una biblioteca concreta */
export function motorBibliotecaEditor(id: number | string): string {
  return `${MOTOR_BIBLIOTECA}/${id}`;
}

/** Legacy `/motor-precios` → redirige en middleware */
export const MOTOR_PRECIOS_LEGACY = "/motor-precios";
