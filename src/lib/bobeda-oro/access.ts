import { NextResponse } from "next/server";
import type { SessionData } from "@/lib/auth/session";
import {
  assertClienteIdAccess as assertCajaClienteIdAccess,
} from "@/lib/caja-bazzar/access";
import { CAJA_CLIENTE_IDS, type CajaClienteId } from "@/lib/caja-bazzar/tiendas";
import { resolveClienteIdFromSession } from "@/lib/caja-bazzar/usuario-tienda";

export { assertCajaClienteIdAccess as assertClienteIdAccess };

export type BobedaAccess = {
  ok: true;
  allowedClienteIds: CajaClienteId[];
  multiTienda: boolean;
};

export type BobedaAccessDenied = {
  ok: false;
  error: NextResponse;
};

function parseTiendaMap(): Record<number, CajaClienteId> {
  const raw = process.env.CAJA_BAZZAR_TIENDA_MAP?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, number>;
    const out: Record<number, CajaClienteId> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const uid = Number(k);
      if (Number.isFinite(uid) && (CAJA_CLIENTE_IDS as readonly number[]).includes(v)) {
        out[uid] = v as CajaClienteId;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** Bóveda ORO — lectura analítica multi-tienda (RIMEC + Bazzar ADMIN). */
export function resolveBobedaAccess(session: SessionData | null): BobedaAccess | BobedaAccessDenied {
  if (!session) {
    return { ok: false, error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  }

  if (session.rol_id === 1) {
    return { ok: true, allowedClienteIds: [...CAJA_CLIENTE_IDS], multiTienda: true };
  }

  if (session.rol_id !== 2) {
    return { ok: false, error: NextResponse.json({ error: "Sin acceso Bóveda ORO" }, { status: 403 }) };
  }

  const cat = (session.role ?? "").toUpperCase().trim();
  if (cat === "ADMIN") {
    return { ok: true, allowedClienteIds: [...CAJA_CLIENTE_IDS], multiTienda: true };
  }

  const map = parseTiendaMap();
  const assigned = map[session.id_usuario] ?? resolveClienteIdFromSession(session);
  if (assigned && (CAJA_CLIENTE_IDS as readonly number[]).includes(assigned)) {
    return { ok: true, allowedClienteIds: [assigned as CajaClienteId], multiTienda: false };
  }

  return {
    ok: false,
    error: NextResponse.json({ error: "Sin acceso a Bóveda ORO para este usuario" }, { status: 403 }),
  };
}
