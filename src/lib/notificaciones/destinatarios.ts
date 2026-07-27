/** Usuarios que reciben alertas pedido Web → Aprobaciones (paridad rimec-web). */
export const DESTINATARIOS_ALERTA_APROBACION = [
  "HECTOR",
  "Guido",
  "Veronica",
] as const;

export function esDestinatarioAlertaAprobacion(nombre: string | null | undefined): boolean {
  const n = String(nombre ?? "").trim().toLowerCase();
  return DESTINATARIOS_ALERTA_APROBACION.some((d) => d.toLowerCase() === n);
}
