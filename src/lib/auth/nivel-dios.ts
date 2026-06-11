/**
 * Nivel Dios — instancia de control superlativo en Report / Aprobaciones.
 * Palabra clave holding: solo usuarios con rol_id = 1 Y categoria = DIOS.
 */
import type { SessionData } from "./session";

export const NIVEL_DIOS_ROL_ID = 1;
export const NIVEL_DIOS_CATEGORIA = "DIOS";

export function isNivelDios(session: SessionData | null | undefined): boolean {
  if (!session) return false;
  const cat = (session.role || "").toUpperCase().trim();
  return session.rol_id === NIVEL_DIOS_ROL_ID && cat === NIVEL_DIOS_CATEGORIA;
}

export function mensajeAccesoNivelDios(): string {
  return "Acceso Nivel Dios requerido: rol_id = 1 y categoria = DIOS en usuario_v2.";
}

/** Solo el módulo /aprobaciones — el resto de Report sigue reglas por rol_id. */
export function canAccessAprobaciones(rolId: number, categoria: string | null | undefined): boolean {
  const cat = (categoria || "").toUpperCase().trim();
  return rolId === NIVEL_DIOS_ROL_ID && cat === NIVEL_DIOS_CATEGORIA;
}
