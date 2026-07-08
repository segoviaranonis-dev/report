import { NextResponse } from "next/server";
import { listTransitoProductos } from "@/lib/stock-transito/queries-productos";
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
    const body = await listTransitoProductos(pool);
    return NextResponse.json({
      ok: true,
      modulo: "stock-transito",
      origen_stock: "TRÁNSITO_PP",
      destino_catalogo: "v_stock_rimec",
      agrupacion: "quincena_arribo_id",
      ...body,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error productos tránsito" },
      { status: 500 },
    );
  }
}
