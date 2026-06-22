import { NextRequest, NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { auditarPreviewEvento } from "@/lib/motor-precios/evento-preview-audit";
import { getPrecioEventoDetalle } from "@/lib/motor-precios/evento-queries";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const eventoId = Number((await params).id);
  if (!Number.isFinite(eventoId) || eventoId <= 0) {
    return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  }

  try {
    const audit = await auditarPreviewEvento(getRimecPool(), eventoId);
    const evento = await getPrecioEventoDetalle(getRimecPool(), eventoId);
    return NextResponse.json({ audit, evento });
  } catch (e) {
    console.error("[GET preview-audit]", e);
    const msg = e instanceof Error ? e.message : "Error en auditoría preview";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
