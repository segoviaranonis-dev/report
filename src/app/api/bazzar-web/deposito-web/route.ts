import { NextResponse } from "next/server";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { fetchDepositoWebData } from "@/lib/bazzar-web/deposito-web/queries";

/** Stock vivo — no cachear en Vercel/CDN (si no, queda 745 eterno). */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET /api/bazzar-web/deposito-web — resumen + detalle por talla */
export async function GET() {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        resumen: [],
        detalle: [],
        metricas: { articulos: 0, pares: 0 },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const data = await fetchDepositoWebData();
    return NextResponse.json(
      { configured: true, ...data },
      { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
    );
  } catch (err) {
    console.error("[bazzar-web/deposito-web]", err);
    return NextResponse.json(
      { error: "Error al cargar depósito web" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
