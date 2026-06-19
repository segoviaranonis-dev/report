import { NextRequest, NextResponse } from "next/server";
import { requireRimecAdmin } from "@/lib/rimec-admin/auth-api";
import { rechazarPpDeCompra } from "@/lib/rimec-abastecimiento/traspaso-mutations";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { error } = await requireRimecAdmin();
  if (error) return error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const { id } = await ctx.params;
  const idCl = parseInt(id, 10);
  if (!Number.isFinite(idCl)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  let body: { pp_id?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const ppId = Number(body.pp_id);
  if (!Number.isFinite(ppId)) {
    return NextResponse.json({ error: "pp_id requerido" }, { status: 400 });
  }

  const result = await rechazarPpDeCompra(idCl, ppId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, message: result.message });
}
