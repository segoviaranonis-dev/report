import { NextResponse } from "next/server";
import { icApiErrorResponse } from "@/lib/intencion-compra/ic-api-error";
import { activarLogisticaPp } from "@/lib/logistica-ok/sync-pp";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { isPoolSaturatedError, poolSaturatedResponse } from "@/lib/rimec/pool-saturated";

type Params = { params: Promise<{ ppId: string }> };

export async function POST(req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const ppId = Number((await params).ppId);
  let body: { fecha_entrega_real?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  try {
    const result = await activarLogisticaPp(
      getRimecPool(),
      ppId,
      body.fecha_entrega_real ?? "",
      gate.session?.id_usuario ?? null,
    );
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    return NextResponse.json({
      ok: true,
      synced: result.synced,
      n_fi: result.n_fi,
      cajas: result.cajas,
    });
  } catch (e) {
    if (isPoolSaturatedError(e)) {
      return NextResponse.json(poolSaturatedResponse(e instanceof Error ? e.message : undefined), {
        status: 503,
        headers: { "Retry-After": "15" },
      });
    }
    const msg = e instanceof Error ? e.message : "Error al activar logística";
    if (/timeout exceeded when trying to connect/i.test(msg)) {
      return NextResponse.json(poolSaturatedResponse(msg), { status: 503, headers: { "Retry-After": "15" } });
    }
    return icApiErrorResponse(e, "Error al activar logística");
  }
}
