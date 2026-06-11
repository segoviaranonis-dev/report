import { NextResponse } from "next/server";
import { fetchFisDePedido } from "@/app/aprobaciones/lib/aprobaciones-queries";

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const pedidoId = parseInt(params.id, 10);
    if (!Number.isFinite(pedidoId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }
    const fis = await fetchFisDePedido(pedidoId);
    return NextResponse.json(fis);
  } catch (err) {
    console.error("Error in /api/aprobaciones/[id]/facturas:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
