import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { assertClienteIdAccess, resolveCajaAccess } from "@/lib/caja-bazzar/access";
import { eliminarLineaEmitida } from "@/lib/caja-bazzar/tickets-edit";
import { isCajaClienteId } from "@/lib/caja-bazzar/tiendas";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";

/**
 * DELETE /api/tablet-bazzar/tickets/linea?cliente_id=&codigo_ticket=
 */
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  const access = resolveCajaAccess(session);
  if (!access.ok) return access.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Base de datos no configurada" }, { status: 500 });
  }

  const sp = new URL(req.url).searchParams;
  const clienteId = Number(sp.get("cliente_id"));
  const codigoTicket = sp.get("codigo_ticket")?.trim() ?? "";

  if (!isCajaClienteId(clienteId) || !codigoTicket) {
    return NextResponse.json({ ok: false, error: "cliente_id y codigo_ticket requeridos" }, { status: 400 });
  }

  const denied = assertClienteIdAccess(access, clienteId);
  if (denied) return denied.error;

  const result = await eliminarLineaEmitida(codigoTicket, clienteId);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({ ok: true, restantes: result.restantes });
}
