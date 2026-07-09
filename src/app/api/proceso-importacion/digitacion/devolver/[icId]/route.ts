import { NextResponse } from "next/server";
import { icApiErrorResponse } from "@/lib/intencion-compra/ic-api-error";
import { devolverIc } from "@/lib/digitacion/actions";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Params = { params: Promise<{ icId: string }> };

export async function POST(req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const icId = Number((await params).icId);
  let body: { motivo?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  try {
    const result = await devolverIc(getRimecPool(), icId, body.motivo ?? "");
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return icApiErrorResponse(e, "Error al devolver IC");
  }
}
