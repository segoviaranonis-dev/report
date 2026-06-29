/**
 * Acceso depósitos Bazzar — P-06 solo tu tienda.
 * rol_id 1 (RIMEC) → 3 entes · sync global.
 * rol_id 2 (Bazzar) → solo ente de sesión (entes.codigo 2–4).
 */

import type { EnteBazzar } from "@/lib/depositos/bazzar-csv-ente-map";
import type { EnteBazzarHub, HubTiendaCard } from "@/lib/depositos/depositos-config";
import { DEPOSITOS_CONFIG, HUB_ENTES } from "@/lib/depositos/depositos-config";

/** entes.codigo → ente hub */
export const ENTE_CODIGO_HUB: Record<number, EnteBazzarHub> = {
  2: "Fernando",
  3: "San Martin",
  4: "Palma",
};

export type DepositoAccesoContext = {
  rol_id: number;
  ente_codigo: number | null;
  /** true = holding / RIMEC — ve hub completo */
  esAdminHolding: boolean;
};

export function buildDepositoAcceso(
  rolId: number,
  enteCodigo: number | null | undefined,
): DepositoAccesoContext {
  return {
    rol_id: rolId,
    ente_codigo: enteCodigo ?? null,
    esAdminHolding: rolId === 1,
  };
}

export function hubEntesVisibles(acceso: DepositoAccesoContext): typeof HUB_ENTES {
  if (acceso.esAdminHolding) return HUB_ENTES;

  const ente = ENTE_CODIGO_HUB[acceso.ente_codigo ?? 0];
  if (!ente) return [];
  return HUB_ENTES.filter((h) => h.ente === ente);
}

export function clienteIdsPermitidos(acceso: DepositoAccesoContext): number[] {
  if (acceso.esAdminHolding) {
    return DEPOSITOS_CONFIG.map((d) => d.cliente_id);
  }
  return hubEntesVisibles(acceso).flatMap((h) =>
    h.tiendas.map((t: HubTiendaCard) => t.cliente_id),
  );
}

export function puedeVerClienteId(acceso: DepositoAccesoContext, clienteId: number): boolean {
  return clienteIdsPermitidos(acceso).includes(clienteId);
}

export function puedeSyncGlobal(acceso: DepositoAccesoContext): boolean {
  return acceso.esAdminHolding;
}

/** Import CSV — holding: 3 entes · Bazzar: solo su ente */
export function puedeImportarCsvGlobal(acceso: DepositoAccesoContext): boolean {
  return acceso.esAdminHolding;
}

export function entesPermitidosImport(acceso: DepositoAccesoContext): EnteBazzar[] {
  return hubEntesVisibles(acceso).map((h) => h.ente as EnteBazzar);
}

export type DepositoAccesoDenegado = {
  ok: false;
  status: 403;
  error: string;
};

export type DepositoAccesoOk = { ok: true };

export function assertAccesoClienteId(
  acceso: DepositoAccesoContext,
  clienteId: number,
): DepositoAccesoOk | DepositoAccesoDenegado {
  if (puedeVerClienteId(acceso, clienteId)) return { ok: true };
  return {
    ok: false,
    status: 403,
    error: `Sin acceso al depósito ${clienteId}. Solo tu tienda asignada.`,
  };
}

export function labelAccesoDeposito(acceso: DepositoAccesoContext): string {
  if (acceso.esAdminHolding) return "Vista holding · 3 entes";
  const ente = ENTE_CODIGO_HUB[acceso.ente_codigo ?? 0];
  return ente ? `Tu ente · ${ente}` : "Sin ente asignado";
}
