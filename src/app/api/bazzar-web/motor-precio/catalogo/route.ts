import { NextRequest, NextResponse } from "next/server";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { getCatalogoPrecios } from "@/lib/bazzar-web/motor-precio/catalogo";

export async function GET() {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false, catalogo: [] }, { status: 503 });
  }
  try {
    const catalogo = await getCatalogoPrecios();
    const conPrecio = catalogo.filter((r) => !r.sin_precio).length;
    return NextResponse.json({
      configured: true,
      catalogo,
      metricas: {
        skus: catalogo.length,
        con_precio: conPrecio,
        sin_precio: catalogo.length - conPrecio,
        pares: catalogo.reduce((s, r) => s + r.stock_pares, 0),
      },
    });
  } catch (err) {
    console.error("[motor-precio/catalogo]", err);
    return NextResponse.json({ error: "Error al cargar catálogo" }, { status: 500 });
  }
}
