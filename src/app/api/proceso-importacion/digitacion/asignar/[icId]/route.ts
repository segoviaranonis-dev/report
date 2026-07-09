import { NextResponse } from "next/server";
import { icApiErrorResponse } from "@/lib/intencion-compra/ic-api-error";
import { asignarIc } from "@/lib/digitacion/actions";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Params = { params: Promise<{ icId: string }> };

export async function POST(req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const icId = Number((await params).icId);
  if (!Number.isFinite(icId)) {
    return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
  }

  let body: {
    precio_evento_id?: number;
    nro_pedido_fabrica?: string;
    pedido_proveedor_id?: number | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  if (!body.precio_evento_id) {
    return NextResponse.json({ ok: false, error: "Evento de precio obligatorio" }, { status: 400 });
  }

  try {
    const result = await asignarIc(getRimecPool(), {
      ic_id: icId,
      precio_evento_id: body.precio_evento_id,
      nro_pedido_fabrica: body.nro_pedido_fabrica ?? "",
      pedido_proveedor_id: body.pedido_proveedor_id ?? null,
      asignado_por: gate.session?.id_usuario ?? null,
    });

    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, pp_id: result.pp_id, pp_numero: result.pp_numero });
  } catch (e) {
    return icApiErrorResponse(e, "Error al asignar PP");
  }
}
