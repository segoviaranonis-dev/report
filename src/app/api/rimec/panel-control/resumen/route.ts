import { NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { getPanelControlResumen } from "@/lib/panel-control/queries-resumen";

export async function GET() {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  try {
    const pool = getRimecPool();
    const resumen = await getPanelControlResumen(pool);
    return NextResponse.json({ ok: true, modulo: "panel-control", ...resumen });
  } catch (e) {
    console.error("[panel-control/resumen]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error panel control" },
      { status: 500 },
    );
  }
}
