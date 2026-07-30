/**
 * VENDEDOR RIMEC en Report.
 * Incluye legado rol_id=3 (ATI, LILI, DARIO…) y rol_id=1 + VENDEDOR.
 *
 * Logística: al lanzar pestaña Vendedor → `LOGISTICA_VENDEDOR_LANZADA = true`.
 * Mientras esté false, solo /ventas-fotos (desarrollo).
 */

export const VENDEDOR_RIMEC_HOME = "/ventas-fotos";

/**
 * false = desarrollo · VENDEDOR no entra a Logística.
 * true  = lanzamiento · VENDEDOR ve Logística (pestaña Vendedor) + Ventas con fotos.
 */
export const LOGISTICA_VENDEDOR_LANZADA = false;

export function isVendedorRimecReport(
  rolId: number,
  categoria: string | null | undefined,
): boolean {
  const cat = String(categoria ?? "")
    .toUpperCase()
    .trim();
  if (cat !== "VENDEDOR") return false;
  return rolId === 1 || rolId === 3;
}

/** Pantallas/APIs permitidas (además de /api/auth/*). */
export function vendedorRimecPathAllowed(pathname: string): boolean {
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/api/ventas-fotos")) return true;
  if (
    pathname === VENDEDOR_RIMEC_HOME ||
    pathname.startsWith(`${VENDEDOR_RIMEC_HOME}/`)
  ) {
    return true;
  }
  if (LOGISTICA_VENDEDOR_LANZADA) {
    if (
      pathname === "/logistica-ok" ||
      pathname.startsWith("/logistica-ok/") ||
      pathname.startsWith("/api/logistica-ok") ||
      pathname.startsWith("/api/logistica-rimec")
    ) {
      return true;
    }
  }
  return false;
}

/** Launcher / rutas que deben ir a Ventas con fotos. */
export function vendedorRimecShouldRedirectHome(pathname: string): boolean {
  return pathname === "/" || pathname === "";
}
