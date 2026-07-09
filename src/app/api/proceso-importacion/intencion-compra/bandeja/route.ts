import { NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { listIcBandeja } from "@/lib/intencion-compra/bandeja-query";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

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
    const raw = e instanceof Error ? e.message : "Error al listar IC";
    const saturated = /max client connections|EMAXCONN/i.test(raw);
    return NextResponse.json(
      {
        ok: false,
        error: saturated
          ? "Conexiones BD saturadas (pool Supabase). Reintentá en 30 s."
          : raw,
        code: saturated ? "EMAXCONN" : undefined,
      },
      { status: saturated ? 503 : 500 },
    );
  }
}
