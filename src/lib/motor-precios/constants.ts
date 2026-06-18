/** Proveedor importadora calzado (paridad Streamlit Motor). */
export const MOTOR_PROVEEDOR_DEFAULT = 654;

/** Biblioteca válida de referencia — Director. */
export const BIBLIOTECA_CANONICA_NOMBRE = "1905";
export const BIBLIOTECA_CANONICA_LABEL = "BIBLIOTECA 1905";

export function esBibliotecaCanonica(nombre: string): boolean {
  const n = nombre.trim();
  return n === BIBLIOTECA_CANONICA_NOMBRE || n.toUpperCase().includes("1905");
}
