/**
 * Perfil JEFE_DEPOSITO — Report solo Depósito RIMEC (2 tarjetas hub).
 * Usuario canónico: EVERT · funcionario Evert Rubén González Servián (JEFE DEPOSITO 1).
 * Asignar descuentos PE = solo DIOS (gate aparte).
 */

export const JEFE_DEPOSITO_CATEGORIA = "JEFE_DEPOSITO";
export const JEFE_DEPOSITO_HOME = "/deposito-rimec";
export const JEFE_DEPOSITO_USUARIO = "EVERT";

/** Hub Depósito RIMEC · tarjetas canónicas + Logística OK (3 pestañas depósito) */
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
  // Grilla PE reusa filtros / panel de reposicion en cliente
  if (pathname.startsWith("/api/herramienta-reposicion")) return true;
  if (pathname.startsWith("/api/panel-control")) return true;

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

  return false;
}

export function jefeDepositoShouldRedirectHome(pathname: string): boolean {
  return pathname === "/" || pathname === "";
}
