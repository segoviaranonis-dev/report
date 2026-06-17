import { NextRequest, NextResponse } from "next/server";
import { requirePilaresAdmin } from "@/lib/pilares/auth-api";
import { parseTipoV2Id } from "@/lib/pilares/constants";
import { loadPilaresMaestras } from "@/lib/pilares/queries";
import type { TipoV2Id } from "@/lib/pilares/types";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export async function GET(req: NextRequest) {
  const gate = await requirePilaresAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false }, { status: 503 });
  }

  try {
    const pool = getRimecPool();
    const tipoV2Id = parseTipoV2Id(req.nextUrl.searchParams.get("tipo_v2_id")) as TipoV2Id;
    const maestras = await loadPilaresMaestras(pool, tipoV2Id);
    return NextResponse.json({ configured: true, tipo_v2_id: tipoV2Id, ...maestras });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al cargar maestras";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
