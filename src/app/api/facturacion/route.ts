import { NextRequest, NextResponse } from "next/server";
import { requireRimecAdmin } from "@/lib/rimec-admin/auth-api";
import { getFacturas, summarizeFacturas } from "@/lib/facturacion/queries";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { isCajaRimec } from "@/lib/auth/caja-rimec";

export async function GET(req: NextRequest) {
  const { session, error } = await requireRimecAdmin();
  if (error) return error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false, facturas: [], kpis: summarizeFacturas([]) }, { status: 503 });
  }

  const clParam = req.nextUrl.searchParams.get("compra_legal_id");
  const idCl = clParam ? parseInt(clParam, 10) : null;
  const origenParam = req.nextUrl.searchParams.get("origen");
  const origen =
    origenParam === "pronta-entrega" ? "pronta-entrega" : ("transito" as const);

  if (isCajaRimec(session!.rol_id, session!.role) && origen !== "pronta-entrega") {
    return NextResponse.json(
      { error: "CAJA RIMEC: solo Facturación Pronta Entrega" },
      { status: 403 },
    );
  }

  try {
    const facturas = await getFacturas(Number.isFinite(idCl!) ? idCl : null, origen);
    return NextResponse.json({
      configured: true,
      origen,
      facturas,
      kpis: summarizeFacturas(facturas),
    });
  } catch (err) {
    console.error("[api/facturacion]", err);
    return NextResponse.json({ error: "Error al listar facturas" }, { status: 500 });
  }
}
