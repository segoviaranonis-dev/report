import { NextRequest, NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getPrecioEventoDetalle } from "@/lib/motor-precios/evento-queries";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const { id } = await ctx.params;
  const eventoId = Number(id);
  if (!Number.isFinite(eventoId) || eventoId <= 0) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  try {
    const evento = await getPrecioEventoDetalle(getRimecPool(), eventoId);
    if (!evento) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ evento });
  } catch (e) {
    console.error("[GET eventos/id]", e);
    const msg = e instanceof Error ? e.message : "Error al cargar evento";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
