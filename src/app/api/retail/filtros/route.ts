import { NextRequest, NextResponse } from "next/server";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { loadRetailFiltrosForBatch } from "@/lib/retail/query-filtros";
import { resolveRetailBatchId } from "@/lib/retail/query-staging";

export async function GET(req: NextRequest) {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false, marcas: [], estilos: [], lineas: [], tipos: [], colores: [] });
  }
  try {
    const batchId = await resolveRetailBatchId(req.nextUrl.searchParams.get("batch_id"));
    if (!batchId) {
      return NextResponse.json({ configured: true, marcas: [], estilos: [], lineas: [], tipos: [], colores: [] });
    }
    const filtros = await loadRetailFiltrosForBatch(batchId);
    return NextResponse.json({ configured: true, ...filtros });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error filtros retail";
    return NextResponse.json({ configured: true, error: msg, marcas: [], estilos: [], lineas: [], tipos: [], colores: [] }, { status: 500 });
  }
}
