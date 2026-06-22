import { NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { listProveedoresImportacion } from "@/lib/motor-precios/evento-carga";
import { mergeProveedoresDb } from "@/lib/motor-precios/proveedores-meta";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export async function GET() {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false, proveedores: [] }, { status: 503 });
  }

  try {
    const rows = await listProveedoresImportacion(getRimecPool());
    const proveedores = mergeProveedoresDb(rows);
    return NextResponse.json({ configured: true, proveedores });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al listar proveedores";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
