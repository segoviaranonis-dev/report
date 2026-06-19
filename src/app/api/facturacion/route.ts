import { NextRequest, NextResponse } from "next/server";
import { requireRimecAdmin } from "@/lib/rimec-admin/auth-api";
import { getFacturas, summarizeFacturas } from "@/lib/facturacion/queries";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export async function GET(req: NextRequest) {
  const { error } = await requireRimecAdmin();
  if (error) return error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false, facturas: [], kpis: summarizeFacturas([]) }, { status: 503 });
  }

  const clParam = req.nextUrl.searchParams.get("compra_legal_id");
  const idCl = clParam ? parseInt(clParam, 10) : null;

  try {
    const facturas = await getFacturas(Number.isFinite(idCl!) ? idCl : null);
    return NextResponse.json({
      configured: true,
      facturas,
      kpis: summarizeFacturas(facturas),
    });
  } catch (err) {
    console.error("[api/facturacion]", err);
    return NextResponse.json({ error: "Error al listar facturas" }, { status: 500 });
  }
}
