import { NextResponse } from "next/server";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { getStockSanoDeposito } from "@/lib/bazzar-web/stock-sano/queries";

export async function GET() {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false }, { status: 503 });
  }
  try {
    const payload = await getStockSanoDeposito();
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[stock-sano]", err);
    return NextResponse.json({ error: "Error al cargar Stock Sano" }, { status: 500 });
  }
}
