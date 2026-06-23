import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { assertClienteIdAccess, resolveCajaAccess } from "@/lib/caja-bazzar/access";
import {
  queryTickets,
  startOfTodayUtc,
  tablaTicketsExiste,
} from "@/lib/caja-bazzar/tickets-db";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";

function parseIntParam(v: string | null): number | undefined {
  if (!v?.trim()) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * GET /api/tablet-bazzar/tickets
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  const access = resolveCajaAccess(session);
  if (!access.ok) return access.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({
      configured: false,
      tickets: [],
      total: 0,
      pares: 0,
      error: "Base de datos no configurada",
    });
  }

  const sp = new URL(req.url).searchParams;
  const clienteId = parseIntParam(sp.get("cliente_id"));
  const vendedorId = parseIntParam(sp.get("vendedor_id"));
  const limit = Math.min(Math.max(parseIntParam(sp.get("limit")) ?? 50, 1), 500);
  const offset = Math.max(parseIntParam(sp.get("offset")) ?? 0, 0);
  const estado = sp.get("estado");
  const cedula = sp.get("cedula");

  if (clienteId != null) {
    const denied = assertClienteIdAccess(access, clienteId);
    if (denied) return denied.error;
  }

  const desdeRaw = sp.get("desde");
  const hastaRaw = sp.get("hasta");
  const desde = desdeRaw ? new Date(desdeRaw) : startOfTodayUtc();
  const hasta = hastaRaw ? new Date(hastaRaw) : null;

  if (Number.isNaN(desde.getTime()) || (hasta && Number.isNaN(hasta.getTime()))) {
    return NextResponse.json({ error: "Fechas inválidas" }, { status: 400 });
  }

  try {
    if (!(await tablaTicketsExiste())) {
      return NextResponse.json({ configured: true, tickets: [], total: 0, pares: 0 });
    }

    const allowedFilter = access.multiTienda
      ? clienteId != null
        ? [clienteId]
        : access.allowedClienteIds
      : access.allowedClienteIds;

    const result = await queryTickets({
      clienteId: access.multiTienda ? clienteId : access.allowedClienteIds[0],
      vendedorId,
      estado,
      cedula,
      desde,
      hasta,
      limit,
      offset,
      allowedClienteIds: allowedFilter,
    });

    return NextResponse.json({
      configured: true,
      tickets: result.tickets,
      total: result.total,
      pares: result.pares,
      pares_hoy: result.pares,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al listar tickets";
    return NextResponse.json({ configured: true, tickets: [], total: 0, pares: 0, error: msg }, { status: 500 });
  }
}
