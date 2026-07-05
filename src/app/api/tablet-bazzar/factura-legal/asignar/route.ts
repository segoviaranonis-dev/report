import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { assertClienteIdAccess, resolveCajaAccess } from "@/lib/caja-bazzar/access";
import { asignarSerialActivoAFacturaBandeja } from "@/lib/caja-bazzar/factura-legal-turno";
import { isCajaClienteId } from "@/lib/caja-bazzar/tiendas";

/** POST /api/tablet-bazzar/factura-legal/asignar — stamp serial activo en bandeja */
export async function POST(req: NextRequest) {
  const session = await getSession();
  const access = resolveCajaAccess(session);
  if (!access.ok) return access.error;

  let body: { cliente_id?: number; staging_id?: number | null; codigos?: string[]; serial?: string };
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

  const r = await asignarSerialActivoAFacturaBandeja({
    clienteId,
    stagingId: body.staging_id ?? null,
    codigos: body.codigos,
    serial: body.serial ?? null,
  });

  if (!r.ok) return NextResponse.json(r, { status: 400 });
  return NextResponse.json(r);
}
