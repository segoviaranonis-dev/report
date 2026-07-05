import { NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { desasignarIcDePp, updateIcVinculadaPp, type UpdateIcVinculadaInput } from "@/lib/pedido-proveedor/cabecera-actions";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Params = { params: Promise<{ ppId: string; icId: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const { ppId: ppRaw, icId: icRaw } = await params;
  const ppId = Number(ppRaw);
  const icId = Number(icRaw);
  if (!Number.isFinite(ppId) || !Number.isFinite(icId)) {
    return NextResponse.json({ ok: false, error: "IDs inválidos" }, { status: 400 });
  }

  let body: UpdateIcVinculadaInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const result = await updateIcVinculadaPp(getRimecPool(), ppId, icId, body);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const { ppId: ppRaw, icId: icRaw } = await params;
  const ppId = Number(ppRaw);
  const icId = Number(icRaw);
  if (!Number.isFinite(ppId) || !Number.isFinite(icId)) {
    return NextResponse.json({ ok: false, error: "IDs inválidos" }, { status: 400 });
  }

  const result = await desasignarIcDePp(getRimecPool(), ppId, icId);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, nro_ic: result.nro_ic, pares: result.pares });
}
