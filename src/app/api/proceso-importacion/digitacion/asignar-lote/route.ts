import { NextResponse } from "next/server";
import { asignarIcLote } from "@/lib/digitacion/actions";
import { icApiErrorResponse } from "@/lib/intencion-compra/ic-api-error";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

/** POST · asignar N IC al mismo PP (crear o agregar). */
export async function POST(req: Request) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  let body: {
    ic_ids?: number[];
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
  if (!Array.isArray(body.ic_ids) || body.ic_ids.length === 0) {
    return NextResponse.json({ ok: false, error: "Seleccioná al menos una IC" }, { status: 400 });
  }

  try {
    const result = await asignarIcLote(getRimecPool(), {
      ic_ids: body.ic_ids,
      precio_evento_id: body.precio_evento_id,
      nro_pedido_fabrica: body.nro_pedido_fabrica ?? "",
      pedido_proveedor_id: body.pedido_proveedor_id ?? null,
      asignado_por: gate.session?.id_usuario ?? null,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          pp_id: result.pp_id,
          pp_numero: result.pp_numero,
          asignadas: result.asignadas,
        },
        { status: 400 },
      );
    }
    return NextResponse.json({
      ok: true,
      pp_id: result.pp_id,
      pp_numero: result.pp_numero,
      asignadas: result.asignadas,
    });
  } catch (e) {
    return icApiErrorResponse(e, "Error al asignar lote");
  }
}
