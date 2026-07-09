import { NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { listIcBandeja } from "@/lib/intencion-compra/bandeja-query";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { isPoolSaturatedError, poolSaturatedResponse } from "@/lib/rimec/pool-saturated";

export async function GET() {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  try {
    const ics = await listIcBandeja(getRimecPool());
    const porEstado: Record<string, number> = {};
    for (const ic of ics) porEstado[ic.estado] = (porEstado[ic.estado] ?? 0) + 1;

    return NextResponse.json({
      ok: true,
      total: ics.length,
      por_estado: porEstado,
      actual: ics[ics.length - 1] ?? null,
      ics,
    });
  } catch (e) {
    if (isPoolSaturatedError(e)) {
      return NextResponse.json(poolSaturatedResponse(), { status: 503, headers: { "Retry-After": "30" } });
    }
    const raw = e instanceof Error ? e.message : "Error al listar IC";
    return NextResponse.json({ ok: false, error: raw }, { status: 500 });
  }
}
