import { NextResponse } from "next/server";
import { requireNivelDiosAction } from "@/app/aprobaciones/lib/require-nivel-dios";
import {
  appendObservacionLogistica,
  listObservacionesPorFi,
} from "@/lib/logistica-ok/observaciones-logistica";
import { getSession } from "@/lib/auth/session";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Ctx = { params: Promise<{ fi_id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireNivelDiosAction();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: 403 });
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL no configurada" }, { status: 503 });
  }
  const fiId = Number((await ctx.params).fi_id);
  if (!Number.isFinite(fiId) || fiId <= 0) {
    return NextResponse.json({ error: "fi_id inválido" }, { status: 400 });
  }
  try {
    const pool = getRimecPool();
    const items = await listObservacionesPorFi(pool, fiId);
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const hint = /logistica_observacion|APROBACION/i.test(msg) ? " Aplicá MIG-198." : "";
    return NextResponse.json({ error: msg + hint }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const gate = await requireNivelDiosAction();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: 403 });
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL no configurada" }, { status: 503 });
  }
  const fiId = Number((await ctx.params).fi_id);
  if (!Number.isFinite(fiId) || fiId <= 0) {
    return NextResponse.json({ error: "fi_id inválido" }, { status: 400 });
  }

  let body: { texto?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });

  const pool = getRimecPool();
  try {
    const result = await appendObservacionLogistica(pool, {
      texto: body.texto ?? "",
      origen: "APROBACION",
      usuarioId: session.id_usuario,
      usuarioNombre: session.name,
      facturaInternaId: fiId,
    });
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, id: result.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const hint = /logistica_observacion|APROBACION/i.test(msg) ? " Aplicá MIG-198." : "";
    return NextResponse.json({ ok: false, error: msg + hint }, { status: 500 });
  }
}
