import { NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { runVincularListadoPython } from "@/lib/pedido-proveedor/run-python-listado";

type Params = { params: Promise<{ ppId: string }> };

export async function POST(req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  const ppId = Number((await params).ppId);
  if (!Number.isFinite(ppId)) {
    return NextResponse.json({ ok: false, error: "PP inválido" }, { status: 400 });
  }

  let body: {
    evento_id?: number;
    recalcular_fi?: boolean;
    incluir_confirmadas?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const eventoId = Number(body.evento_id);
  if (!Number.isFinite(eventoId)) {
    return NextResponse.json({ ok: false, error: "evento_id inválido" }, { status: 400 });
  }

  const result = await runVincularListadoPython(ppId, eventoId, {
    recalcularFi: body.recalcular_fi !== false,
    incluirConfirmadas: Boolean(body.incluir_confirmadas),
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? result.message ?? "Error al vincular" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: result.message,
    stats: result.stats,
    actualizados: result.stats?.snapshot?.actualizados,
  });
}
