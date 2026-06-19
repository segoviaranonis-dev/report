import { NextResponse } from "next/server";
import { requireRimecAdmin } from "@/lib/rimec-admin/auth-api";
import { getComprasLegales } from "@/lib/compra-legal/queries";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export async function GET() {
  const { error } = await requireRimecAdmin();
  if (error) return error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false, compras: [] }, { status: 503 });
  }

  try {
    const compras = await getComprasLegales();
    return NextResponse.json({ configured: true, compras });
  } catch (err) {
    console.error("[api/compra-legal]", err);
    return NextResponse.json({ error: "Error al listar compras legales" }, { status: 500 });
  }
}
