import { NextRequest, NextResponse } from "next/server";
import { requireRimecAdmin } from "@/lib/rimec-admin/auth-api";
import { getStockDeposito, summarizeDeposito } from "@/lib/deposito-rimec/queries";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export async function GET(req: NextRequest) {
  const { error } = await requireRimecAdmin();
  if (error) return error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false, saldo: [], kpis: summarizeDeposito([]) }, { status: 503 });
  }

  const clParam = req.nextUrl.searchParams.get("compra_legal_id");
  const idCl = clParam ? parseInt(clParam, 10) : null;

  try {
    const saldo = await getStockDeposito(Number.isFinite(idCl!) ? idCl : null);
    return NextResponse.json({
      configured: true,
      saldo,
      kpis: summarizeDeposito(saldo),
    });
  } catch (err) {
    console.error("[api/deposito-rimec/saldo]", err);
    return NextResponse.json({ error: "Error al cargar saldo depósito" }, { status: 500 });
  }
}
