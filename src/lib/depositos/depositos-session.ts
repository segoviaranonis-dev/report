import { aplicarAccesoCanonicoBzz } from "@/lib/auth/bzz-acceso";
import { getSession } from "@/lib/auth/session";
import {
  assertAccesoClienteId,
  buildDepositoAcceso,
  type DepositoAccesoContext,
} from "@/lib/depositos/depositos-acceso";

export async function getDepositoAccesoFromSession(): Promise<DepositoAccesoContext | null> {
  const session = await getSession();
  if (!session) return null;

  const bzz = aplicarAccesoCanonicoBzz(
    session.name,
    session.rol_id,
    session.ente_codigo ?? null,
  );

  return buildDepositoAcceso(bzz.rol_id, bzz.ente_codigo);
}

export type DepositoAccessGate =
  | { ok: true; acceso: DepositoAccesoContext }
  | { ok: false; status: number; error: string };

export async function requireDepositoClienteAccess(
  clienteId: number,
): Promise<DepositoAccessGate> {
  const acceso = await getDepositoAccesoFromSession();
  if (!acceso) {
    return { ok: false, status: 401, error: "No autenticado" };
  }
  const check = assertAccesoClienteId(acceso, clienteId);
  if (!check.ok) {
    return { ok: false, status: check.status, error: check.error };
  }
  return { ok: true, acceso };
}
