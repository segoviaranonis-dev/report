/**
 * Perfil CAJA RIMEC — Report solo Facturación Pronta Entrega.
 * rol_id=1 (RIMEC) + categoria=CAJA · sin RIMEC Web / Streamlit / Tablet / resto Report.
 */

export const CAJA_RIMEC_CATEGORIA = "CAJA";
export const CAJA_RIMEC_HOME = "/facturacion/pronta-entrega";
export const CAJA_RIMEC_USUARIO = "CAJA_RIMEC";

export function isCajaRimec(
  rolId: number,
  categoria: string | null | undefined,
): boolean {
  return (
    rolId === 1 &&
    String(categoria ?? "")
      .toUpperCase()
      .trim() === CAJA_RIMEC_CATEGORIA
  );
}

/** Pantallas/APIs permitidas (además de /api/auth/*). */
export function cajaRimecPathAllowed(pathname: string): boolean {
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/api/facturacion")) return true;
  if (
    pathname === CAJA_RIMEC_HOME ||
    pathname.startsWith(`${CAJA_RIMEC_HOME}/`)
  ) {
    return true;
  }
  return false;
}

/** Rutas que deben redirigir al home CAJA (launcher / hub). */
export function cajaRimecShouldRedirectHome(pathname: string): boolean {
  if (pathname === "/" || pathname === "/facturacion" || pathname === "/facturacion/") {
    return true;
  }
  return false;
}
