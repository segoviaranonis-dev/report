import { NextRequest, NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { aplicarBibliotecaAEvento } from "@/lib/motor-precios/evento-biblioteca";
import { getPrecioEventoDetalle } from "@/lib/motor-precios/evento-queries";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Ctx = { params: Promise<{ id: string }> };

/** Copiar casos bib → evento (Paso 2 Casos — no usar en Memoria). */
export async function POST(req: NextRequest, ctx: Ctx) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const { id } = await ctx.params;
  const eventoId = Number(id);
  if (!Number.isFinite(eventoId) || eventoId <= 0) {
    return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  }

  let body: { biblioteca_id?: number; reemplazar_matriz?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const bibliotecaId = Number(body.biblioteca_id);
  if (!Number.isFinite(bibliotecaId) || bibliotecaId <= 0) {
    return NextResponse.json({ ok: false, error: "biblioteca_id requerido" }, { status: 400 });
  }

  const pool = getRimecPool();
  const { rows: evRows } = await pool.query<{ proveedor_id: string; estado: string }>(
    `SELECT proveedor_id, estado FROM precio_evento WHERE id = $1`,
    [eventoId],
  );
  const ev = evRows[0];
  if (!ev) {
    return NextResponse.json({ ok: false, error: "Evento no encontrado" }, { status: 404 });
  }
  if (String(ev.estado).toLowerCase() === "cerrado") {
    return NextResponse.json({ ok: false, error: "Evento cerrado" }, { status: 409 });
  }

  const result = await aplicarBibliotecaAEvento(
    pool,
    eventoId,
    Number(ev.proveedor_id),
    bibliotecaId,
    body.reemplazar_matriz !== false,
  );

  if (!result.ok) {
    return NextResponse.json(result, { status: 422 });
  }

  const evento = await getPrecioEventoDetalle(pool, eventoId);
  return NextResponse.json({ ...result, evento });
}
