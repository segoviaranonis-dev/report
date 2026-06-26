/**
 * Acreditación Report por ente (usuario_v2.ente_id → entes.codigo).
 * Tienda Bazzar (2–4) ≠ RIMEC (1) ≠ Bazzar Web (5).
 */
import type { ReportHubGroup } from "@/lib/report/hub-modules";

export const ENTE_COD_RIMEC = 1;
export const ENTE_COD_BAZZAR_WEB = 5;

const RIMEC_PATH_PREFIXES = [
  "/rimec",
  "/ventas-fotos",
  "/aprobaciones",
  "/pilares",
  "/rrhh",
  "/proceso-importacion",
  "/holding",
  "/compra-legal",
  "/facturacion",
  "/deposito-rimec",
];

const BAZZAR_TIENDA_PATH_PREFIXES = ["/retail", "/depositos-bazzar", "/tablet-bazzar"];

const BAZZAR_WEB_PATH_PREFIXES = ["/bazzar-web"];

const RECURSOS_PATH_PREFIXES = ["/informes"];

/** Grupos de hub visibles según ente. rol_id=1 (holding) ve todo. rol_id=2 solo tienda. */
export function hubGroupsForEnte(
  enteCodigo: number | null | undefined,
  rolId: number,
): ReportHubGroup[] {
  if (rolId === 2) {
    return ["bazzar"];
  }

  if (rolId === 1) {
    return ["rimec", "bazzar", "bazzar-web", "recursos"];
  }

  const cod = Number(enteCodigo) || 0;

  if (cod === ENTE_COD_RIMEC) {
    return ["rimec", "recursos"];
  }
  if (cod >= 2 && cod <= 4) {
    return ["bazzar"];
  }
  if (cod === ENTE_COD_BAZZAR_WEB) {
    return ["bazzar-web"];
  }
  if (cod >= 6 && cod <= 12) {
    return ["bazzar"];
  }

  return ["bazzar"];
}

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Rutas de pantalla permitidas por ente (post-rol). */
export function pathnameAllowedForEnte(
  pathname: string,
  enteCodigo: number | null | undefined,
  rolId: number,
): boolean {
  if (pathname === "/") return true;
  if (rolId === 1) return true;

  const groups = hubGroupsForEnte(enteCodigo, rolId);

  if (groups.includes("rimec") && matchesPrefix(pathname, RIMEC_PATH_PREFIXES)) return true;
  if (groups.includes("bazzar") && matchesPrefix(pathname, BAZZAR_TIENDA_PATH_PREFIXES)) return true;
  if (groups.includes("bazzar-web") && matchesPrefix(pathname, BAZZAR_WEB_PATH_PREFIXES)) return true;
  if (groups.includes("recursos") && matchesPrefix(pathname, RECURSOS_PATH_PREFIXES)) return true;

  return false;
}

/** APIs permitidas por ente (rol 2 tienda no toca RRHH ni bazzar-web). */
export function apiAllowedForEnte(
  pathname: string,
  enteCodigo: number | null | undefined,
  rolId: number,
): boolean {
  if (rolId === 1) return true;

  const groups = hubGroupsForEnte(enteCodigo, rolId);

  if (pathname.startsWith("/api/auth/")) return true;

  if (groups.includes("rimec")) {
    if (
      pathname.startsWith("/api/rimec/") ||
      pathname.startsWith("/api/ventas-fotos/") ||
      pathname.startsWith("/api/aprobaciones/") ||
      pathname.startsWith("/api/pilares/") ||
      pathname.startsWith("/api/rrhh/") ||
      pathname.startsWith("/api/motor-precios/") ||
      pathname.startsWith("/api/holding/") ||
      pathname.startsWith("/api/facturacion/") ||
      pathname.startsWith("/api/deposito-rimec/") ||
      pathname.startsWith("/api/compra-legal/")
    ) {
      return true;
    }
  }

  if (groups.includes("bazzar")) {
    if (
      pathname.startsWith("/api/retail/") ||
      pathname.startsWith("/api/depositos/") ||
      pathname.startsWith("/api/tablet-bazzar/")
    ) {
      return true;
    }
  }

  if (groups.includes("bazzar-web")) {
    if (pathname.startsWith("/api/bazzar-web/")) return true;
  }

  return false;
}
