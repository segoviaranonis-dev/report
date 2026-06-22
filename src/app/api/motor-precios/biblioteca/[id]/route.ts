import { NextRequest, NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { loadBibliotecaEditor } from "@/lib/motor-precios/biblioteca-editor";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const bibliotecaId = Number((await params).id);
  if (!Number.isFinite(bibliotecaId) || bibliotecaId <= 0) {
    return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  }

  const pool = getRimecPool();
  const { rows } = await pool.query<{ proveedor_id: string }>(
    `SELECT proveedor_id FROM biblioteca_precio WHERE id = $1 AND activo = true`,
    [bibliotecaId],
  );
  if (!rows[0]) {
    return NextResponse.json({ ok: false, error: "Biblioteca no encontrada" }, { status: 404 });
  }

  const payload = await loadBibliotecaEditor(pool, bibliotecaId, Number(rows[0].proveedor_id));
  if (!payload) {
    return NextResponse.json({ ok: false, error: "No se pudo cargar editor" }, { status: 500 });
  }
  return NextResponse.json({ configured: true, ...payload });
}
