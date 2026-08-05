import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { getMensajeDetalle, marcarLeido } from "@/lib/mensajes-internos/queries";

type Ctx = { params: Promise<{ id: string }> };

/** GET · detalle + marca leído · adjuntos incluyen total_pares */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  }

  try {
    const pool = getRimecPool();
    const mensaje = await getMensajeDetalle(pool, session.id_usuario, id);
    if (!mensaje) {
      return NextResponse.json({ ok: false, error: "No encontrado" }, { status: 404 });
    }
    await marcarLeido(pool, session.id_usuario, id);
    return NextResponse.json({
      ok: true,
      mensaje: { ...mensaje, leido: true },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/** PATCH · marcar leído sin reabrir */
export async function PATCH(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }
  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  }
  try {
    const ok = await marcarLeido(getRimecPool(), session.id_usuario, id);
    if (!ok) {
      return NextResponse.json({ ok: false, error: "No encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
