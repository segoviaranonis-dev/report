import { NextResponse } from "next/server";
import { requireRimecAdmin } from "@/lib/rimec-admin/auth-api";
import { getComprasDistribuidas } from "@/lib/deposito-rimec/queries";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export async function GET() {
  const { error } = await requireRimecAdmin();
  if (error) return error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false, compras: [] }, { status: 503 });
  }

  try {
    const compras = await getComprasDistribuidas();
    return NextResponse.json({ configured: true, compras });
  } catch (err) {
    console.error("[api/deposito-rimec/compras]", err);
    return NextResponse.json({ error: "Error al listar compras distribuidas" }, { status: 500 });
  }
}
