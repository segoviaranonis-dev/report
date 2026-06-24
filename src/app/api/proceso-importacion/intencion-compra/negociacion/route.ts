import { NextResponse } from "next/server";
import { getLineasConCaso, getListadosParaCaso } from "@/lib/intencion-compra/catalogos-query";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export async function GET(req: Request) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const url = new URL(req.url);
  const proveedorId = Number(url.searchParams.get("proveedor_id") ?? "0");
  const eventoId = Number(url.searchParams.get("evento_id") ?? "0");
  const caso = url.searchParams.get("caso");

  try {
    const pool = getRimecPool();
    if (caso && eventoId) {
      const listados = await getListadosParaCaso(pool, eventoId, caso);
      return NextResponse.json({ ok: true, listados });
    }
    const lineas = await getLineasConCaso(pool, proveedorId || 0);
    return NextResponse.json({ ok: true, lineas });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
