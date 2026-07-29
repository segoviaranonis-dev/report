import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  loadMaestrasFiltroTriangulo,
  parseTipoV2IdParam,
  tipoV2IdFromRamoTipo,
} from "@/lib/pilares/maestras-filtro-triangulo";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

/**
 * GET /api/pilares/maestras-filtro?tipo_v2_id=1|&ramo_tipo=CALZADO
 * Estilo + Género canónicos del Administrador de Pilares (FK).
 * Sesión RIMEC — no exige admin pilares (AM/DPE/Web siamese).
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.rol_id !== 1) {
    return NextResponse.json({ error: "Sesión RIMEC requerida" }, { status: 403 });
  }
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false }, { status: 503 });
  }

  try {
    const sp = req.nextUrl.searchParams;
    const fromRamo = tipoV2IdFromRamoTipo(sp.get("ramo_tipo"));
    const tipoV2Id = fromRamo ?? parseTipoV2IdParam(sp.get("tipo_v2_id"));
    const pool = getRimecPool();
    const data = await loadMaestrasFiltroTriangulo(pool, tipoV2Id);
    return NextResponse.json({ configured: true, ...data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error maestras filtro";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
