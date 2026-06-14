import { NextRequest, NextResponse } from "next/server";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { activarRegla, crearRegla, desactivarRegla, editarRegla, listarReglas } from "@/lib/bazzar-web/motor-precio/reglas";

export async function GET() {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false, reglas: [] }, { status: 503 });
  }
  try {
    const reglas = await listarReglas();
    return NextResponse.json({ configured: true, reglas });
  } catch (err) {
    console.error("[motor-precio/reglas GET]", err);
    return NextResponse.json({ error: "Error al listar reglas" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }
  try {
    const body = await req.json();
    const result = await crearRegla(
      String(body.caso_codigo ?? ""),
      Number(body.markup_pct),
      String(body.descripcion ?? ""),
    );
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[motor-precio/reglas POST]", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }
  try {
    const body = await req.json();
    const id = Number(body.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }
    const result = await editarRegla(id, Number(body.markup_pct), String(body.descripcion ?? ""));
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[motor-precio/reglas PATCH]", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }
  try {
    const body = await req.json();
    const id = Number(body.id);
    const activo = Boolean(body.activo);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }
    if (activo) await activarRegla(id);
    else await desactivarRegla(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[motor-precio/reglas PUT]", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
