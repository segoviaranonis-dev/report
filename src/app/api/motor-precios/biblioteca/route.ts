import { NextRequest, NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { findBibliotecaCanonica, listBibliotecasPorProveedor } from "@/lib/motor-precios/queries";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export async function GET(req: NextRequest) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false, bibliotecas: [] }, { status: 503 });
  }

  const proveedorRaw = req.nextUrl.searchParams.get("proveedor_id");
  const proveedorId = Number(proveedorRaw ?? 654);
  if (!Number.isFinite(proveedorId) || proveedorId <= 0) {
    return NextResponse.json({ ok: false, error: "proveedor_id inválido" }, { status: 400 });
  }

  try {
    const bibliotecas = await listBibliotecasPorProveedor(getRimecPool(), proveedorId);
    const canonica = findBibliotecaCanonica(bibliotecas);
    return NextResponse.json({ configured: true, bibliotecas, canonica });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al listar bibliotecas";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
