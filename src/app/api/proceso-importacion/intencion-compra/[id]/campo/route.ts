import { NextResponse } from "next/server";
import { updateCampoIc } from "@/lib/intencion-compra/update-campo-ic";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const icId = Number((await params).id);
  if (!Number.isFinite(icId)) {
    return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
  }

  let body: { campo?: string; valor?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  if (!body.campo) {
    return NextResponse.json({ ok: false, error: "campo requerido" }, { status: 400 });
  }

  try {
    const result = await updateCampoIc(getRimecPool(), icId, body.campo, body.valor);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al actualizar";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
