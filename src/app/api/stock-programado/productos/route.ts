import { NextResponse } from "next/server";
import { listProgramadoProductos } from "@/lib/stock-programado/queries-productos";
import { listVentasCompradorProgramado } from "@/lib/stock-programado/queries-ventas-comprador";
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
    const body = await listProgramadoProductos(pool);
    let ventasComprador: Record<string, unknown> = {};
    try {
      const ventasMap = await listVentasCompradorProgramado(pool);
      ventasComprador = Object.fromEntries(ventasMap);
    } catch (e) {
      console.error("[stock-programado/productos] ventasComprador:", e);
    }
    return NextResponse.json({
      ok: true,
      modulo: "stock-programado",
      origen_stock: "pedido_proveedor_detalle",
      categoria: "PROGRAMADO",
      destino_catalogo: "sin RIMEC Web",
      agrupacion: "quincena_arribo_id",
      ventasComprador,
      ...body,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error productos programado" },
      { status: 500 },
    );
  }
}
