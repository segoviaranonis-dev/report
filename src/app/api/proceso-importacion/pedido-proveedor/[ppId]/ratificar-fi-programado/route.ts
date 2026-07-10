import { NextResponse } from "next/server";
import { icApiErrorResponse } from "@/lib/intencion-compra/ic-api-error";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import {
  auditarFiIntegridadProgramado,
  diagnoseProgramadoFiPlan,
  ratificarFiProgramadoCompleto,
} from "@/lib/pedido-proveedor/proforma-programado-engine";

export const maxDuration = 300;

type Params = { params: Promise<{ ppId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  const ppId = Number((await params).ppId);
  if (!Number.isFinite(ppId)) {
    return NextResponse.json({ ok: false, error: "PP inválido" }, { status: 400 });
  }

  try {
    const [plan, integridad] = await Promise.all([
      diagnoseProgramadoFiPlan(ppId),
      auditarFiIntegridadProgramado(ppId),
    ]);
    return NextResponse.json({ ok: true, plan, integridad });
  } catch (e) {
    return icApiErrorResponse(e, "Error al diagnosticar FI programado");
  }
}

export async function POST(req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  const ppId = Number((await params).ppId);
  if (!Number.isFinite(ppId)) {
    return NextResponse.json({ ok: false, error: "PP inválido" }, { status: 400 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { regenerar?: boolean };
    const result = await ratificarFiProgramadoCompleto(ppId, { regenerar: Boolean(body.regenerar) });
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    return icApiErrorResponse(e, "Error al ratificar FI programado");
  }
}
