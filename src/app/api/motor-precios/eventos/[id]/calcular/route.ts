import { NextRequest, NextResponse } from "next/server";
import { icApiErrorResponse } from "@/lib/intencion-compra/ic-api-error";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { ejecutarCalculoPaso3, muestraPrecioLista, resumenPaso3 } from "@/lib/motor-precios/evento-paso3";
import { getPrecioEventoDetalle } from "@/lib/motor-precios/evento-queries";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Params = { params: Promise<{ id: string }> };

/** 2388 SKUs + calcular_precio_lista_evento_sql puede superar 60s en Vercel. */
export const maxDuration = 300;

export async function GET(_req: NextRequest, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const eventoId = Number((await params).id);
  if (!Number.isFinite(eventoId) || eventoId <= 0) {
    return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  }

  const pool = getRimecPool();
  const resumen = await resumenPaso3(pool, eventoId);
  const muestra = await muestraPrecioLista(pool, eventoId, 80);
  const evento = await getPrecioEventoDetalle(pool, eventoId);
  if (!evento) {
    return NextResponse.json({ ok: false, error: "Evento no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, resumen, muestra, evento });
}

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

  let body: { recalcular?: boolean } = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const pool = getRimecPool();
  try {
    const { rows: evRows } = await pool.query<{ proveedor_id: string }>(
      `SELECT proveedor_id FROM precio_evento WHERE id = $1`,
      [eventoId],
    );
    if (!evRows[0]) {
      return NextResponse.json({ ok: false, error: "Evento no encontrado" }, { status: 404 });
    }

    const result = await ejecutarCalculoPaso3(pool, eventoId, Number(evRows[0].proveedor_id), {
      recalcular: body.recalcular === true,
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: 422 });
    }

    const evento = await getPrecioEventoDetalle(pool, eventoId);
    const muestra = await muestraPrecioLista(pool, eventoId, 80);
    return NextResponse.json({ ...result, evento, muestra });
  } catch (e) {
    return icApiErrorResponse(e, "Error al calcular precios");
  }
}
