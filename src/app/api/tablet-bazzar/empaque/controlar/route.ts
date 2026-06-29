import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { assertClienteIdAccess, resolveCajaAccess } from "@/lib/caja-bazzar/access";
import { marcarLineaControlada } from "@/lib/caja-bazzar/empaque-db";

/** POST /api/tablet-bazzar/empaque/controlar */
export async function POST(req: NextRequest) {
  const session = await getSession();
  const access = resolveCajaAccess(session);
  if (!access.ok) return access.error;

  let body: { cliente_id?: number; codigo_oro?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const clienteId = Number(body.cliente_id);
  const codigo = body.codigo_oro?.trim();
  if (!Number.isFinite(clienteId) || !codigo) {
    return NextResponse.json({ ok: false, error: "cliente_id y codigo_oro requeridos" }, { status: 400 });
  }

  const denied = assertClienteIdAccess(access, clienteId);
  if (denied) return denied.error;

  const r = await marcarLineaControlada(clienteId, codigo, session?.name ?? null);
  if (!r.ok) return NextResponse.json(r, { status: 400 });
  return NextResponse.json({ ok: true });
}
