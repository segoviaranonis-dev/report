import { NextResponse } from "next/server";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { fetchDepositoWebData } from "@/lib/bazzar-web/deposito-web/queries";

/** GET /api/bazzar-web/deposito-web — resumen + detalle por talla */
export async function GET() {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({
      configured: false,
      resumen: [],
      detalle: [],
      metricas: { articulos: 0, pares: 0 },
    }, { status: 503 });
  }

  try {
    const data = await fetchDepositoWebData();
    return NextResponse.json({ configured: true, ...data });
  } catch (err) {
    console.error("[bazzar-web/deposito-web]", err);
    return NextResponse.json({ error: "Error al cargar depósito web" }, { status: 500 });
  }
}
