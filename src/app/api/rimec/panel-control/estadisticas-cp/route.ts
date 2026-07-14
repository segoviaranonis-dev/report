import { NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { getCompraPreviaEstadisticasDetalle } from "@/lib/panel-control/compra-previa-canonical";

export async function GET() {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  try {
    const pool = getRimecPool();
    const detalle = await getCompraPreviaEstadisticasDetalle(pool);
    return NextResponse.json({ ok: true, modulo: "panel-control-cp-estadisticas", ...detalle });
  } catch (e) {
    console.error("[panel-control/estadisticas-cp]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error estadísticas CP" },
      { status: 500 },
    );
  }
}
