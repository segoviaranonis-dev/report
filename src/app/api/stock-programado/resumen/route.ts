import { NextResponse } from "next/server";
import { getStockProgramadoResumen } from "@/lib/stock-programado/queries-resumen";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export async function GET() {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  try {
    const resumen = await getStockProgramadoResumen(getRimecPool());
    return NextResponse.json({ ok: true, resumen });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error resumen programado" },
      { status: 500 },
    );
  }
}
