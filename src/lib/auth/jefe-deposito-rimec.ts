/**
 * Perfil JEFE_DEPOSITO — Report hub 2 opciones: Depósito RIMEC + Logística OK.
 * Usuario canónico: EVERT · funcionario Evert Rubén González Servián (JEFE DEPOSITO 1).
 * Stock PE entra desde hub Depósito (tarjeta interna). Asignar descuentos PE = solo DIOS.
 */

export const JEFE_DEPOSITO_CATEGORIA = "JEFE_DEPOSITO";
/** Hub central Report · 2 tarjetas (Depósito + Logística) */
export const JEFE_DEPOSITO_HOME = "/";
export const JEFE_DEPOSITO_USUARIO = "EVERT";

/** Rutas permitidas · Stock PE anidado bajo depósito */
export const JEFE_DEPOSITO_MODULES = [
  "/deposito-rimec",
  "/stock-pronta-entrega",
  "/logistica-ok",
] as const;

export function isJefeDepositoRimec(
  rolId: number,
  categoria: string | null | undefined,
): boolean {
  return (
    rolId === 1 &&
    String(categoria ?? "")
      .toUpperCase()
      .trim() === JEFE_DEPOSITO_CATEGORIA
  );
}

export function jefeDepositoPathAllowed(pathname: string): boolean {
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/api/deposito-rimec")) return true;
  if (pathname.startsWith("/api/stock-pronta-entrega")) return true;
  if (pathname.startsWith("/api/herramienta-reposicion")) return true;
  if (pathname.startsWith("/api/panel-control")) return true;

  if (pathname === "/" || pathname === "") return true;

  if (
    pathname === "/deposito-rimec" ||
    pathname.startsWith("/deposito-rimec/")
  ) {
    return true;
  }
  if (
    pathname === "/stock-pronta-entrega" ||
    pathname.startsWith("/stock-pronta-entrega/")
  ) {
    return true;
  }
  if (pathname === "/logistica-ok" || pathname.startsWith("/logistica-ok/")) {
    return true;
  }
  if (pathname.startsWith("/api/logistica-ok")) return true;
  if (pathname.startsWith("/api/logistica-rimec")) return true;

  return false;
}

/** Ya no redirige / → depósito: el hub central muestra 2 opciones. */
export function jefeDepositoShouldRedirectHome(_pathname: string): boolean {
  return false;
}
