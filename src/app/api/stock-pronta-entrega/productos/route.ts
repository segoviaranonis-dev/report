import { NextRequest, NextResponse } from "next/server";
import { listImportadoProductos } from "@/lib/deposito-rimec/queries-productos-grilla";
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
    const body = await listImportadoProductos(pool, {
      deposito: sp.get("deposito") ?? undefined,
      batch: sp.get("batch") ?? undefined,
      tipo_v2: sp.get("tipo_v2") === "1" ? 1 : sp.get("tipo_v2") === "2" ? 2 : undefined,
    });
    return NextResponse.json({
      ok: true,
      modulo: "stock-pronta-entrega",
      origen_stock: "STOCK_PRONTA_ENTREGA",
      destino_catalogo: "v_stock_rimec",
      ...body,
      batch: sp.get("batch") ?? body.batch ?? "sdrm0831",
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error productos PE" },
      { status: 500 },
    );
  }
}
