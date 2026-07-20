import { NextResponse } from "next/server";
import { icApiErrorResponse } from "@/lib/intencion-compra/ic-api-error";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { actualizarEncabezadoFiDesdePp } from "@/lib/pedido-proveedor/fi-pp-actions";
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

  let body: {
    plazo_id?: number;
    descuento_1?: number;
    descuento_2?: number;
    descuento_3?: number;
    descuento_4?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const plazoId = Number(body.plazo_id);
  if (!Number.isFinite(plazoId) || plazoId <= 0) {
    return NextResponse.json({ ok: false, error: "Plazo inválido." }, { status: 400 });
  }

  try {
    const result = await actualizarEncabezadoFiDesdePp(getRimecPool(), ppId, fiId, {
      plazoId,
      descuento_1: Number(body.descuento_1 ?? 0),
      descuento_2: Number(body.descuento_2 ?? 0),
      descuento_3: Number(body.descuento_3 ?? 0),
      descuento_4: Number(body.descuento_4 ?? 0),
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, total_monto: result.totalMonto });
  } catch (e) {
    return icApiErrorResponse(e, "Error al actualizar encabezado FI");
  }
}
