import { NextResponse } from "next/server";
import { listIcPendientesDigitacion, listPpsDigitacionCerrados, listPpsEnProceso } from "@/lib/digitacion/bandeja-query";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export async function GET() {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }
  try {
    const pool = getRimecPool();
    const [pendientes, enProceso, cerrados] = await Promise.all([
      listIcPendientesDigitacion(pool),
      listPpsEnProceso(pool),
      listPpsDigitacionCerrados(pool),
    ]);
    return NextResponse.json({
      ok: true,
      pendientes,
      en_proceso: enProceso,
      cerrados_digitacion: cerrados,
      stats: { pendientes: pendientes.length },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
