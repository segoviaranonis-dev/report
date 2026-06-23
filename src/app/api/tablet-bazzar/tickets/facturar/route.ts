import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { assertClienteIdAccess, resolveCajaAccess } from "@/lib/caja-bazzar/access";
import { marcarFacturados, tablaTicketsExiste } from "@/lib/caja-bazzar/tickets-db";
import { isCajaClienteId } from "@/lib/caja-bazzar/tiendas";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";

/**
 * POST /api/tablet-bazzar/tickets/facturar
 * Body: { cliente_id, codigos: string[] }
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  const access = resolveCajaAccess(session);
  if (!access.ok) return access.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Base de datos no configurada" }, { status: 500 });
  }

  let body: { cliente_id?: number; codigos?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const clienteId = Number(body.cliente_id);
  if (!isCajaClienteId(clienteId)) {
    return NextResponse.json({ ok: false, error: "cliente_id inválido" }, { status: 400 });
  }

  const denied = assertClienteIdAccess(access, clienteId);
  if (denied) return denied.error;

  const codigos = Array.isArray(body.codigos) ? body.codigos.filter(Boolean) : [];
  if (!codigos.length) {
    return NextResponse.json({ ok: false, error: "Sin tickets seleccionados" }, { status: 400 });
  }

  try {
    if (!(await tablaTicketsExiste())) {
      return NextResponse.json({ ok: false, error: "Tabla ticket_venta_pos no existe" }, { status: 503 });
    }
    const { updated } = await marcarFacturados(codigos, clienteId);
    return NextResponse.json({ ok: true, updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al facturar";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
