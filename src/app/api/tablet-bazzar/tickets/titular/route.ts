import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { assertClienteIdAccess, resolveCajaAccess } from "@/lib/caja-bazzar/access";
import { actualizarTitularFacturaEmitida } from "@/lib/caja-bazzar/tickets-edit";
import { isCajaClienteId } from "@/lib/caja-bazzar/tiendas";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";

/**
 * PATCH /api/tablet-bazzar/tickets/titular
 * Body: { cliente_id, staging_id?, codigos?, cedula, nombre, apellido? }
 */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  const access = resolveCajaAccess(session);
  if (!access.ok) return access.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Base de datos no configurada" }, { status: 500 });
  }

  let body: {
    cliente_id?: number;
    staging_id?: number | null;
    codigos?: string[];
    cedula?: string;
    nombre?: string;
    apellido?: string | null;
    ruc?: string | null;
    telefono?: string | null;
    email?: string | null;
  };
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

  const stagingId =
    body.staging_id != null && Number.isFinite(Number(body.staging_id)) ? Number(body.staging_id) : null;

  const result = await actualizarTitularFacturaEmitida({
    clienteId,
    stagingId,
    codigos: Array.isArray(body.codigos) ? body.codigos.filter(Boolean) : [],
    cedula: body.cedula ?? "",
    nombre: body.nombre ?? "",
    apellido: body.apellido,
    ruc: body.ruc,
    telefono: body.telefono,
    email: body.email,
  });

  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({ ok: true, updated: result.updated });
}
