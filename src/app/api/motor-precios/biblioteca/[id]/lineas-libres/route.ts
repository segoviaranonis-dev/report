import { NextRequest, NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import {
  aplicarAsignacionesLineasLibres,
  listLineasLibres,
  loadBibliotecaEditor,
} from "@/lib/motor-precios/biblioteca-editor";
import { MOTOR_PROVEEDOR_DEFAULT } from "@/lib/motor-precios/constants";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false, lineas: [] }, { status: 503 });
  }

  const { id } = await ctx.params;
  const bibliotecaId = Number(id);

  try {
    const pool = getRimecPool();
    const [lineas, editor] = await Promise.all([
      listLineasLibres(pool, bibliotecaId, MOTOR_PROVEEDOR_DEFAULT),
      loadBibliotecaEditor(pool, bibliotecaId, MOTOR_PROVEEDOR_DEFAULT),
    ]);
    if (!editor) {
      return NextResponse.json({ error: "Biblioteca no encontrada" }, { status: 404 });
    }
    return NextResponse.json({
      configured: true,
      lineas,
      casos: editor.casos.map((c) => ({ id: c.id, nombre_caso: c.nombre_caso })),
      total: lineas.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al listar líneas libres";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const { id } = await ctx.params;
  const bibliotecaId = Number(id);

  let body: { asignaciones?: { codigo: string; caso_id: number }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const asignaciones = body.asignaciones ?? [];
  if (!asignaciones.length) {
    return NextResponse.json({ ok: false, error: "No hay asignaciones para aplicar" }, { status: 400 });
  }

  try {
    const pool = getRimecPool();
    const result = await aplicarAsignacionesLineasLibres(
      pool,
      bibliotecaId,
      MOTOR_PROVEEDOR_DEFAULT,
      asignaciones,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al aplicar asignaciones";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
