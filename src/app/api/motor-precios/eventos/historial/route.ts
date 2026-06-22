import { NextRequest, NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { listHistorialEventos } from "@/lib/motor-precios/evento-historial";
import { MOTOR_PROVEEDOR_DEFAULT } from "@/lib/motor-precios/constants";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export async function GET(req: NextRequest) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false, eventos: [] }, { status: 503 });
  }

  const proveedorRaw = req.nextUrl.searchParams.get("proveedor_id");
  const busqueda = req.nextUrl.searchParams.get("q") ?? "";
  const proveedor_id = proveedorRaw ? Number(proveedorRaw) : MOTOR_PROVEEDOR_DEFAULT;

  try {
    const eventos = await listHistorialEventos(getRimecPool(), {
      proveedor_id: Number.isFinite(proveedor_id) ? proveedor_id : MOTOR_PROVEEDOR_DEFAULT,
      busqueda,
    });
    const resumen = {
      total: eventos.length,
      en_uso: eventos.filter((e) => e.uso.en_uso).length,
      en_uso_pp: eventos.filter((e) => e.uso.en_uso_pp).length,
      en_uso_ic: eventos.filter((e) => e.uso.en_uso_ic).length,
      borrador: eventos.filter((e) => e.estado_real === "borrador").length,
      cerrado: eventos.filter((e) => e.estado_real === "cerrado").length,
      basura: eventos.filter((e) => e.estado_real === "borrador" && e.total_skus === 0).length,
    };
    return NextResponse.json({ configured: true, eventos, resumen });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al cargar historial";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
