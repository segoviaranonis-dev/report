import { NextRequest, NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { copiarCasosDesdeBiblioteca, loadBibliotecaEditor } from "@/lib/motor-precios/biblioteca-editor";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const { id } = await ctx.params;
  const destBibliotecaId = Number(id);
  if (!Number.isFinite(destBibliotecaId) || destBibliotecaId <= 0) {
    return NextResponse.json({ ok: false, error: "biblioteca_id inválido" }, { status: 400 });
  }

  let body: { origen_biblioteca_id?: number; reemplazar?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const origenId = Number(body.origen_biblioteca_id);
  if (!Number.isFinite(origenId) || origenId <= 0) {
    return NextResponse.json({ ok: false, error: "origen_biblioteca_id obligatorio" }, { status: 400 });
  }

  const pool = getRimecPool();
  const meta = await pool.query<{ proveedor_id: string }>(
    `SELECT proveedor_id FROM biblioteca_precio WHERE id = $1 AND activo = true`,
    [destBibliotecaId],
  );
  if (!meta.rows[0]) {
    return NextResponse.json({ ok: false, error: "Biblioteca destino no encontrada" }, { status: 404 });
  }
  const proveedorId = Number(meta.rows[0].proveedor_id);

  try {
    const result = await copiarCasosDesdeBiblioteca(
      pool,
      destBibliotecaId,
      origenId,
      proveedorId,
      body.reemplazar === true,
    );
    const editor = await loadBibliotecaEditor(pool, destBibliotecaId, proveedorId);
    return NextResponse.json({ ok: true, ...result, biblioteca: editor });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al copiar casos";
    const status = msg.includes("Confirmá reemplazo") ? 422 : 400;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
