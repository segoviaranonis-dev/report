import { NextRequest, NextResponse } from "next/server";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { getTraspasos, summarizeTraspasos } from "@/lib/bazzar-web/compra-web/queries";

/** GET /api/bazzar-web/compra/traspasos?estado=ENVIADO|BORRADOR|CONFIRMADO */
export async function GET(req: NextRequest) {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json(
      { configured: false, traspasos: [], metricas: { total: 0, enviados: 0, confirmados: 0 } },
      { status: 503 },
    );
  }

  const estado = req.nextUrl.searchParams.get("estado");
  const filter =
    estado && estado !== "TODOS" && ["ENVIADO", "BORRADOR", "CONFIRMADO"].includes(estado)
      ? estado
      : null;

  try {
    const traspasos = await getTraspasos(filter);
    return NextResponse.json({
      configured: true,
      traspasos,
      metricas: summarizeTraspasos(traspasos),
    });
  } catch (err) {
    console.error("[bazzar-web/compra/traspasos]", err);
    return NextResponse.json({ error: "Error al listar traspasos" }, { status: 500 });
  }
}
