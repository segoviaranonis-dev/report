import { NextResponse } from "next/server";
import { eliminarIc } from "@/lib/intencion-compra/ic-actions";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { icApiErrorResponse } from "@/lib/intencion-compra/ic-api-error";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const icId = Number((await params).id);
  if (!Number.isFinite(icId)) {
    return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
  }

  try {
    const result = await eliminarIc(getRimecPool(), icId);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return icApiErrorResponse(e, "Error al eliminar");
  }
}
