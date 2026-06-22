import { NextRequest, NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { cerrarEventoPrecio } from "@/lib/motor-precios/evento-cierre";
import { getPrecioEventoDetalle } from "@/lib/motor-precios/evento-queries";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const eventoId = Number((await params).id);
  if (!Number.isFinite(eventoId) || eventoId <= 0) {
    return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  }

  const pool = getRimecPool();
  const result = await cerrarEventoPrecio(pool, eventoId, gate.session?.id_usuario ?? null);
  if (!result.ok) {
    return NextResponse.json(result, { status: 422 });
  }

  const evento = await getPrecioEventoDetalle(pool, eventoId);
  return NextResponse.json({ ok: true, cierre: result.data, evento });
}
