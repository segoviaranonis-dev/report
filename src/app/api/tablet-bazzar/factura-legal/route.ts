import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { assertClienteIdAccess, resolveCajaAccess } from "@/lib/caja-bazzar/access";
import {
  avanzarSiguienteFacturaLegal,
  fijarSerialActivoFacturaLegal,
  obtenerFacturaLegalTurno,
  retrocederAnteriorFacturaLegal,
} from "@/lib/caja-bazzar/factura-legal-turno";
import { isCajaClienteId } from "@/lib/caja-bazzar/tiendas";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";

function parseClienteIdParam(raw: string | null): number | null {
  if (!raw?.trim()) return null;
  const n = Number(raw.trim());
  return Number.isFinite(n) && isCajaClienteId(n) ? n : null;
}

/** GET /api/tablet-bazzar/factura-legal?cliente_id= */
export async function GET(req: NextRequest) {
  const session = await getSession();
  const access = resolveCajaAccess(session);
  if (!access.ok) return access.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Base de datos no configurada" });
  }

  const clienteId = parseClienteIdParam(req.nextUrl.searchParams.get("cliente_id"));
  if (clienteId == null) {
    return NextResponse.json({ ok: false, error: "cliente_id requerido" }, { status: 400 });
  }

  const denied = assertClienteIdAccess(access, clienteId);
  if (denied) return denied.error;

  const turno = await obtenerFacturaLegalTurno(clienteId);
  if (!turno) {
    return NextResponse.json({ ok: false, error: "Turno factura legal no disponible" }, { status: 503 });
  }

  return NextResponse.json({ ok: true, turno });
}

/** POST /api/tablet-bazzar/factura-legal — siguiente | anterior | set */
export async function POST(req: NextRequest) {
  const session = await getSession();
  const access = resolveCajaAccess(session);
  if (!access.ok) return access.error;

  let body: { cliente_id?: number; action?: string; serial?: string };
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

  const action = (body.action ?? "").trim().toLowerCase();
  const operador = session?.name ?? null;

  if (action === "siguiente") {
    const r = await avanzarSiguienteFacturaLegal(clienteId, operador);
    if (!r.ok) return NextResponse.json(r, { status: 400 });
    return NextResponse.json(r);
  }
  if (action === "anterior") {
    const r = await retrocederAnteriorFacturaLegal(clienteId, operador);
    if (!r.ok) return NextResponse.json(r, { status: 400 });
    return NextResponse.json(r);
  }
  if (action === "set" && body.serial) {
    const r = await fijarSerialActivoFacturaLegal(clienteId, body.serial, operador);
    if (!r.ok) return NextResponse.json(r, { status: 400 });
    return NextResponse.json(r);
  }

  return NextResponse.json({ ok: false, error: "action inválida (siguiente|anterior|set)" }, { status: 400 });
}
