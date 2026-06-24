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

    const ids = ics.map((i) => i.id);
    const missingIds: number[] = [];
    if (ids.length) {
      for (let i = ids[0]; i <= ids[ids.length - 1]; i++) {
        if (!ids.includes(i)) missingIds.push(i);
      }
    }

    return NextResponse.json({
      ok: true,
      total: ics.length,
      min_id: ids[0] ?? null,
      max_id: ids[ids.length - 1] ?? null,
      actual: ics[ics.length - 1] ?? null,
      ids_faltantes: missingIds,
      por_estado: porEstado,
      ics,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error en auditoría IC";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
