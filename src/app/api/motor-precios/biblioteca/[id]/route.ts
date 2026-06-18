import { NextRequest, NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { loadBibliotecaEditor } from "@/lib/motor-precios/biblioteca-editor";
import { MOTOR_PROVEEDOR_DEFAULT } from "@/lib/motor-precios/constants";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false }, { status: 503 });
  }

  const { id } = await ctx.params;
  const bibliotecaId = Number(id);
  const proveedorId = MOTOR_PROVEEDOR_DEFAULT;

  try {
    const pool = getRimecPool();
    const editor = await loadBibliotecaEditor(pool, bibliotecaId, proveedorId);
    if (!editor) {
      return NextResponse.json({ error: "Biblioteca no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ configured: true, ...editor });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al cargar biblioteca";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
