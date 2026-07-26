import { NextResponse } from "next/server";
import { marcarObservacionLeida } from "@/lib/logistica-ok/observaciones-logistica";
import type { LogisticaTabId } from "@/lib/logistica-ok/constants";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export async function POST(req: Request) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  let body: { fi_id?: number; pestana?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const fiId = Number(body.fi_id);
  if (!Number.isFinite(fiId) || fiId <= 0) {
    return NextResponse.json({ ok: false, error: "fi_id inválido" }, { status: 400 });
  }

  const pestana = (body.pestana ?? "general") as LogisticaTabId;
  const session = gate.session!;

  try {
    await marcarObservacionLeida(getRimecPool(), fiId, session.id_usuario, pestana);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
