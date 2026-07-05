import { NextRequest, NextResponse } from "next/server";
import { getStockImportado } from "@/lib/deposito-rimec/queries-stock-importado";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export async function GET(req: NextRequest) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const sp = req.nextUrl.searchParams;
  try {
    const pool = getRimecPool();
    const body = await getStockImportado(pool, {
      deposito: sp.get("deposito") ?? undefined,
      batch: sp.get("batch") ?? undefined,
    });
    return NextResponse.json({ ok: true, origen_stock: "STOCK_IMPORTADO", ...body });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error stock importado" },
      { status: 500 },
    );
  }
}
