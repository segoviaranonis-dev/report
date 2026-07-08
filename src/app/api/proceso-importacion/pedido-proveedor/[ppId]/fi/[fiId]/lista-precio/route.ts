import { NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { actualizarListaPrecioFiDesdePp } from "@/lib/pedido-proveedor/fi-pp-actions";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Params = { params: Promise<{ ppId: string; fiId: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const { ppId: ppRaw, fiId: fiRaw } = await params;
  const ppId = Number(ppRaw);
  const fiId = Number(fiRaw);
  if (!Number.isFinite(ppId) || !Number.isFinite(fiId)) {
    return NextResponse.json({ ok: false, error: "IDs inválidos" }, { status: 400 });
  }

  let body: { lista_precio_id?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const listaPrecioId = Number(body.lista_precio_id);
  const result = await actualizarListaPrecioFiDesdePp(getRimecPool(), ppId, fiId, listaPrecioId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, total_monto: result.totalMonto });
}
