import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { assertClienteIdAccess, resolveCajaAccess } from "@/lib/caja-bazzar/access";
import { enviarBandejaAEmpaque, tablaBandejaExiste, tablaBobedaExiste } from "@/lib/caja-bazzar/handoff-bobeda";
import { avanzarSiguienteFacturaLegal } from "@/lib/caja-bazzar/factura-legal-turno";
import { isCajaClienteId } from "@/lib/caja-bazzar/tiendas";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";

/**
 * POST /api/tablet-bazzar/tickets/enviar-empaque
 * Body: { cliente_id, codigos?: string[], staging_id?: number }
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  const access = resolveCajaAccess(session);
  if (!access.ok) return access.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Base de datos no configurada" }, { status: 500 });
  }

  let body: { cliente_id?: number; codigos?: string[]; staging_id?: number | null };
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

  const codigos = Array.isArray(body.codigos) ? body.codigos.filter(Boolean) : undefined;
  const stagingId = body.staging_id != null ? Number(body.staging_id) : null;

  if (!codigos?.length && stagingId == null) {
    return NextResponse.json({ ok: false, error: "Sin codigos ni staging_id" }, { status: 400 });
  }

  try {
    if (!(await tablaBandejaExiste()) || !(await tablaBobedaExiste())) {
      return NextResponse.json(
        { ok: false, error: "Tablas bandeja/bobeda no existen — aplicar migración 005" },
        { status: 503 },
      );
    }

    const r = await enviarBandejaAEmpaque({
      clienteId,
      codigos,
      stagingId: Number.isFinite(stagingId) ? stagingId : null,
    });

    if (!r.ok) {
      return NextResponse.json({ ok: false, error: r.error }, { status: 400 });
    }

    await avanzarSiguienteFacturaLegal(clienteId, session?.name ?? null);

    return NextResponse.json({ ok: true, inserted: r.inserted, serial_avanzado: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al enviar a Empaque";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
