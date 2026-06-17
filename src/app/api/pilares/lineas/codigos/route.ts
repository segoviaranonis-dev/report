import { NextRequest, NextResponse } from "next/server";
import { requirePilaresAdmin } from "@/lib/pilares/auth-api";
import { parseTipoV2Id } from "@/lib/pilares/constants";
import { searchLineaCodigos } from "@/lib/pilares/queries";
import type { TipoV2Id } from "@/lib/pilares/types";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export async function GET(req: NextRequest) {
  const gate = await requirePilaresAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false, codigos: [] }, { status: 503 });
  }

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const tipoV2Id = parseTipoV2Id(sp.get("tipo_v2_id")) as TipoV2Id;
  if (!q) {
    return NextResponse.json({ configured: true, codigos: [] });
  }

  try {
    const pool = getRimecPool();
    const codigos = await searchLineaCodigos(pool, tipoV2Id, q, Number(sp.get("limit") ?? 12));
    return NextResponse.json({ configured: true, codigos });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al buscar líneas";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
