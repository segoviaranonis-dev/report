import { NextRequest, NextResponse } from "next/server";
import { requirePilaresAdmin } from "@/lib/pilares/auth-api";
import { parseTipoV2Id, proveedorIdFromTipoV2 } from "@/lib/pilares/constants";
import { loadPrimeraImagenPorColorCode } from "@/lib/pilares/queries";
import type { ColorThumb, TipoV2Id } from "@/lib/pilares/types";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

/** Solo miniaturas por color_code — no recalcula catálogo ni grilla. */
export async function POST(req: NextRequest) {
  const gate = await requirePilaresAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false, thumbs: {} }, { status: 503 });
  }

  try {
    const body = (await req.json()) as {
      tipo_v2_id?: number | string;
      codes?: unknown;
    };
    const tipoV2Id = parseTipoV2Id(String(body.tipo_v2_id ?? 1)) as TipoV2Id;
    const proveedorId = proveedorIdFromTipoV2(tipoV2Id);
    if (proveedorId == null) {
      return NextResponse.json({ error: "tipo_v2_id inválido" }, { status: 400 });
    }
    const codes = Array.isArray(body.codes)
      ? body.codes.map((c) => String(c ?? "").trim()).filter(Boolean)
      : [];
    if (!codes.length) {
      return NextResponse.json({ configured: true, thumbs: {} });
    }

    const pool = getRimecPool();
    const map = await loadPrimeraImagenPorColorCode(pool, codes, tipoV2Id);
    const thumbs: Record<string, ColorThumb> = {};
    for (const [k, v] of map) thumbs[k] = v;
    return NextResponse.json({ configured: true, thumbs });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al cargar thumbs color";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
