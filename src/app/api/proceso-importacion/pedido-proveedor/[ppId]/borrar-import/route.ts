import { NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { borrarImportacionPp, getEstadoBorradoImportPp } from "@/lib/pedido-proveedor/borrar-import";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Params = { params: Promise<{ ppId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const ppId = Number((await params).ppId);
  if (!Number.isFinite(ppId)) {
    return NextResponse.json({ ok: false, error: "PP inválido" }, { status: 400 });
  }

  try {
    const estado = await getEstadoBorradoImportPp(getRimecPool(), ppId);
    return NextResponse.json({ ok: true, estado });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error al evaluar borrado" },
      { status: 500 },
    );
  }
}

export async function POST(_req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const ppId = Number((await params).ppId);
  if (!Number.isFinite(ppId)) {
    return NextResponse.json({ ok: false, error: "PP inválido" }, { status: 400 });
  }

  try {
    const result = await borrarImportacionPp(getRimecPool(), ppId);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
    }
    return NextResponse.json({ ok: true, message: result.message });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error al borrar importación" },
      { status: 500 },
    );
  }
}
