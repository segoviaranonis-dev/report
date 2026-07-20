import { NextResponse } from "next/server";
import { icApiErrorResponse } from "@/lib/intencion-compra/ic-api-error";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { actualizarVendedorFiDesdePp } from "@/lib/pedido-proveedor/fi-pp-actions";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Params = { params: Promise<{ ppId: string; fiId: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const { ppId: ppRaw, fiId: fiRaw } = await params;
  const ppId = Number(ppRaw);
  const fiId = Number(fiRaw);
  if (!Number.isFinite(ppId) || !Number.isFinite(fiId)) {
    return NextResponse.json({ ok: false, error: "IDs inválidos" }, { status: 400 });
  }

  let body: { id_vendedor?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  try {
    const vendedorId = Number(body.id_vendedor);
    const result = await actualizarVendedorFiDesdePp(getRimecPool(), ppId, fiId, vendedorId);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, vendedor: result.vendedor });
  } catch (e) {
    return icApiErrorResponse(e, "Error al actualizar vendedor FI");
  }
}
