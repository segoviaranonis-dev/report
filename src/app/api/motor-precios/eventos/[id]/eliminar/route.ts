import { NextRequest, NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { eliminarEventoPrecio } from "@/lib/motor-precios/evento-historial";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const eventoId = Number((await params).id);
  if (!Number.isFinite(eventoId) || eventoId <= 0) {
    return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  }

  let body: { confirmacion?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  if (String(body.confirmacion ?? "").trim().toUpperCase() !== "ELIMINAR") {
    return NextResponse.json({ ok: false, error: 'Escribí ELIMINAR para confirmar' }, { status: 422 });
  }

  const result = await eliminarEventoPrecio(getRimecPool(), eventoId);
  if (!result.ok) {
    return NextResponse.json(result, { status: 422 });
  }
  return NextResponse.json(result);
}
