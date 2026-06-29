import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { assertClienteIdAccess, resolveCajaAccess } from "@/lib/caja-bazzar/access";
import { sellarFacturaEmpaque } from "@/lib/caja-bazzar/empaque-db";

/** POST /api/tablet-bazzar/empaque/sellar — bóveda de oro ENTREGADO */
export async function POST(req: NextRequest) {
  const session = await getSession();
  const access = resolveCajaAccess(session);
  if (!access.ok) return access.error;

  let body: { cliente_id?: number; staging_id?: number | null; nombre_confirmado?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const clienteId = Number(body.cliente_id);
  if (!Number.isFinite(clienteId)) {
    return NextResponse.json({ ok: false, error: "cliente_id requerido" }, { status: 400 });
  }

  const denied = assertClienteIdAccess(access, clienteId);
  if (denied) return denied.error;

  const r = await sellarFacturaEmpaque({
    clienteId,
    stagingId: body.staging_id ?? null,
    nombreConfirmado: body.nombre_confirmado ?? "",
  });
  if (!r.ok) return NextResponse.json(r, { status: 400 });
  return NextResponse.json(r);
}
