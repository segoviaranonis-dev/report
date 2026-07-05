import { NextResponse } from "next/server";
import { listComprasDistribuidas } from "@/lib/deposito-rimec/queries-proceso";
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
    const compras = await listComprasDistribuidas(pool);
    return NextResponse.json({ ok: true, compras });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error listando CL" },
      { status: 500 },
    );
  }
}
