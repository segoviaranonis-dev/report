import { NextResponse } from "next/server";
import { fetchFiDetallesLite } from "@/app/aprobaciones/lib/aprobaciones-queries";

export async function GET(
  _request: Request,
  props: { params: Promise<{ fi_id: string }> }
) {
  try {
    const params = await props.params;
    const fiId = parseInt(params.fi_id, 10);
    if (!Number.isFinite(fiId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }
    const items = await fetchFiDetallesLite(fiId);
    return NextResponse.json(items);
  } catch (err) {
    console.error("Error in /api/aprobaciones/facturas/[fi_id]/items:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
