/**
 * Paridad con core/auth.py — AuthManager.login (Streamlit).
 * La validación real ocurre en servidor (Route Handler) con DATABASE_URL.
 */

export const ROLE_MAP_TO_ADMIN: Record<string, true> = {
  DIRECTOR: true,
  ROOT: true,
  ADMINISTRADOR: true,
  GERENTE: true,
};

export function normalizeRole(rawCategoria: string): string {
  const u = String(rawCategoria || "")
    .toUpperCase()
    .trim();
  return ROLE_MAP_TO_ADMIN[u] ? "ADMIN" : u;
}

/** SQL idéntico en semántica a Streamlit (parámetros :usuario :pass). */
export const LOGIN_SQL = `
SELECT id_usuario, descp_usuario, categoria
FROM usuario_v2
WHERE descp_usuario = :usuario
  AND password = :pass
LIMIT 1
`.trim();
