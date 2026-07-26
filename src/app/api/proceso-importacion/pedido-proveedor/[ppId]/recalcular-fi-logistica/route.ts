import { NextResponse } from "next/server";
import { icApiErrorResponse } from "@/lib/intencion-compra/ic-api-error";
import { esListadoPrecioValido } from "@/lib/intencion-compra/listado-precio-tiers";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { recalcFiLpLogisticaSevero } from "@/lib/pedido-proveedor/recalc-fi-lp-logistica";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Params = { params: Promise<{ ppId: string }> };

/** POST · Botón impositor «Asignar listado de Precios» + sync Logística. */
export async function POST(req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const ppId = Number((await params).ppId);
  if (!Number.isFinite(ppId)) {
    return NextResponse.json({ ok: false, error: "PP inválido" }, { status: 400 });
  }

  let body: {
    fi_ids?: number[];
    lista_precio_id?: number;
    modo_impositor?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const fiIds = Array.isArray(body.fi_ids) ? body.fi_ids.map(Number).filter((n) => n > 0) : [];
  const listaPrecioId = Number(body.lista_precio_id);

  if (fiIds.length === 0) {
    return NextResponse.json({ ok: false, error: "fi_ids vacío" }, { status: 400 });
  }
  if (!esListadoPrecioValido(listaPrecioId)) {
    return NextResponse.json({ ok: false, error: "lista_precio_id obligatorio (1–4)" }, { status: 400 });
  }

  try {
    const result = await recalcFiLpLogisticaSevero(getRimecPool(), ppId, {
      fiIds,
      listaPrecioId,
      modoImpositor: body.modo_impositor !== false,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ...result, ok: false, error: result.errores.join(" · ") || "Imposición falló" },
        { status: 422 },
      );
    }

    return NextResponse.json({ ...result, ok: true });
  } catch (e) {
    return icApiErrorResponse(e, "Error botón impositor Asignar listado de Precios");
  }
}
