import { NextResponse } from "next/server";
import type { SessionData } from "@/lib/auth/session";
import { CAJA_CLIENTE_IDS, type CajaClienteId, getCajaTienda, isCajaClienteId } from "./tiendas";
import { resolveClienteIdFromSession } from "./usuario-tienda";

export type CajaAccess = {
  ok: true;
  allowedClienteIds: CajaClienteId[];
  multiTienda: boolean;
};

export type CajaAccessDenied = {
  ok: false;
  error: NextResponse;
};

/** Mapa JSON env: {"123":2100,"456":2400} id_usuario → cliente_id tienda */
function parseTiendaMap(): Record<number, CajaClienteId> {
  const raw = process.env.CAJA_BAZZAR_TIENDA_MAP?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, number>;
    const out: Record<number, CajaClienteId> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const uid = Number(k);
      if (Number.isFinite(uid) && isCajaClienteId(v)) out[uid] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function resolveCajaAccess(session: SessionData | null): CajaAccess | CajaAccessDenied {
  if (!session) {
    return {
      ok: false,
      error: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
    };
  }

  if (session.rol_id !== 1 && session.rol_id !== 2) {
    return {
      ok: false,
      error: NextResponse.json({ error: "Sin acceso Caja Bazzar" }, { status: 403 }),
    };
  }

  // RIMEC rol 1 — auditoría multi-tienda
  if (session.rol_id === 1) {
    return {
      ok: true,
      allowedClienteIds: [...CAJA_CLIENTE_IDS],
      multiTienda: true,
    };
  }

  // BAZZAR rol 2 ADMIN — acordeón completo
  const cat = (session.role ?? "").toUpperCase().trim();
  if (cat === "ADMIN") {
    return {
      ok: true,
      allowedClienteIds: [...CAJA_CLIENTE_IDS],
      multiTienda: true,
    };
  }

  const map = parseTiendaMap();
  const fromMap = map[session.id_usuario];
  const fromProfile = resolveClienteIdFromSession({
    name: session.name,
    id_usuario: session.id_usuario,
    rol_id: session.rol_id,
    role: session.role,
  });
  const assigned = fromMap ?? fromProfile;
  if (assigned && isCajaClienteId(assigned)) {
    return {
      ok: true,
      allowedClienteIds: [assigned],
      multiTienda: false,
    };
  }

  return {
    ok: false,
    error: NextResponse.json(
      {
        error:
          "Usuario sin tienda asignada. Configurar CAJA_BAZZAR_TIENDA_MAP o rol BAZZAR ADMIN.",
      },
      { status: 403 },
    ),
  };
}

export function assertClienteIdAccess(
  access: CajaAccess,
  clienteId: number,
): CajaAccessDenied | null {
  if (!isCajaClienteId(clienteId) || !getCajaTienda(clienteId)) {
    return {
      ok: false,
      error: NextResponse.json({ error: "Tienda inválida" }, { status: 400 }),
    };
  }
  if (!access.allowedClienteIds.includes(clienteId)) {
    return {
      ok: false,
      error: NextResponse.json({ error: "Sin acceso a esta caja" }, { status: 403 }),
    };
  }
  return null;
}
