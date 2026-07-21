import { NextRequest, NextResponse } from "next/server";
import { icApiErrorResponse } from "@/lib/intencion-compra/ic-api-error";
import { cambiarBibliotecaPp } from "@/lib/pedido-proveedor/cabecera-biblioteca";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Params = { params: Promise<{ ppId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const ppId = Number((await params).ppId);
  if (!Number.isFinite(ppId)) {
    return NextResponse.json({ ok: false, error: "PP inválido" }, { status: 400 });
  }

  let body: { biblioteca_precio_id?: number; confirmar_destructivo?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const bibliotecaId = Number(body.biblioteca_precio_id);
  if (!Number.isFinite(bibliotecaId) || bibliotecaId <= 0) {
    return NextResponse.json({ ok: false, error: "biblioteca_precio_id obligatorio." }, { status: 400 });
  }

  try {
    const result = await cambiarBibliotecaPp(getRimecPool(), ppId, bibliotecaId, {
      confirmar_destructivo: body.confirmar_destructivo === true,
    });
    if (!result.ok) {
      const status = result.requiere_confirmacion ? 409 : 400;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json(result);
  } catch (e) {
    return icApiErrorResponse(e, "Error al cambiar biblioteca");
  }
}
