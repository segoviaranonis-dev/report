import { NextRequest, NextResponse } from "next/server";
import { listProcesoProductos } from "@/lib/deposito-rimec/queries-productos-grilla";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export async function GET(req: NextRequest) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const clRaw = req.nextUrl.searchParams.get("compra_legal_id");
  const compraLegalId = clRaw ? Number(clRaw) : undefined;

  try {
    const pool = getRimecPool();
    const body = await listProcesoProductos(
      pool,
      compraLegalId != null && Number.isFinite(compraLegalId) ? compraLegalId : undefined,
    );
    return NextResponse.json({
      ok: true,
      origen_stock: "PROCESO_PP",
      ente: "RIMEC",
      codigo: "PROCESO-PP",
      ...body,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error" },
      { status: 500 },
    );
  }
}
