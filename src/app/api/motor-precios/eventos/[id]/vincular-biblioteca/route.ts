import { NextRequest, NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { aplicarBibliotecaAEvento, vincularBibliotecaAEvento } from "@/lib/motor-precios/evento-biblioteca";
import { getPrecioEventoDetalle } from "@/lib/motor-precios/evento-queries";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Paso 1 Memoria — solo FK precio_evento.biblioteca_precio_id.
 * No copia casos (eso es módulo biblioteca / Paso 2).
 */
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

  let body: { biblioteca_id?: number };
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
    return NextResponse.json({ ok: false, error: "Evento cerrado — no se puede cambiar biblioteca" }, { status: 409 });
  }

  const { rows: bibRows } = await pool.query<{ proveedor_id: string; nombre: string }>(
    `SELECT proveedor_id, nombre FROM biblioteca_precio WHERE id = $1`,
    [bibliotecaId],
  );
  const bib = bibRows[0];
  if (!bib) {
    return NextResponse.json({ ok: false, error: "Biblioteca no encontrada" }, { status: 404 });
  }
  if (Number(bib.proveedor_id) !== Number(ev.proveedor_id)) {
    return NextResponse.json(
      { ok: false, error: "La biblioteca no pertenece al mismo proveedor del evento" },
      { status: 422 },
    );
  }

  try {
    await vincularBibliotecaAEvento(pool, eventoId, bibliotecaId);

    const aplicar = await aplicarBibliotecaAEvento(
      pool,
      eventoId,
      Number(ev.proveedor_id),
      bibliotecaId,
      true,
    );

    if (!aplicar.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: aplicar.error,
          biblioteca_id: bibliotecaId,
          evento: await getPrecioEventoDetalle(pool, eventoId),
        },
        { status: 422 },
      );
    }

    const evento = await getPrecioEventoDetalle(pool, eventoId);
    return NextResponse.json({
      ok: true,
      biblioteca_id: bibliotecaId,
      biblioteca_nombre: bib.nombre,
      casos_copiados: aplicar.n_casos,
      casos_error: null,
      evento,
    });
  } catch (e) {
    console.error("[POST vincular-biblioteca]", e);
    const msg = e instanceof Error ? e.message : "Error al vincular biblioteca";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
