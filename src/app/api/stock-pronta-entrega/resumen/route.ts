import { NextRequest, NextResponse } from "next/server";
import { getStockProntaEntregaResumen } from "@/lib/stock-pronta-entrega/queries-resumen";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export async function GET(req: NextRequest) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const sp = req.nextUrl.searchParams;
  const tipoRaw = sp.get("tipo_v2");
  const tipo_v2 = tipoRaw === "1" || tipoRaw === "2" ? Number(tipoRaw) : undefined;

  try {
    const pool = getRimecPool();
    const resumen = await getStockProntaEntregaResumen(pool, {
      deposito: sp.get("deposito") ?? undefined,
      batch: sp.get("batch") ?? undefined,
      tipo_v2,
    });
    return NextResponse.json({
      ok: true,
      modulo: "stock-pronta-entrega",
      alerta_arquitectura:
        "TRAMPA Hiedra Venenosa · staging + v_stock_rimec · destino pedido_proveedor_detalle",
      ...resumen,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error resumen PE" },
      { status: 500 },
    );
  }
}
