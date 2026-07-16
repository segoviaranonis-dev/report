import { NextRequest, NextResponse } from "next/server";
import { requirePilaresAdmin } from "@/lib/pilares/auth-api";
import { aplicarMapaSdrmPilares, previewMapaSdrmPilares } from "@/lib/pilares/aplicar-mapa-sdrm";
import { SDRM_BATCH_DEFAULT } from "@/lib/pilares/sdrm-pilares-map";
import { parseTipoV2Id } from "@/lib/pilares/constants";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export async function GET(req: NextRequest) {
  const gate = await requirePilaresAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "BD no configurada" }, { status: 503 });
  }

  const sp = req.nextUrl.searchParams;
  const tipoV2Id = parseTipoV2Id(sp.get("tipo_v2_id"));
  const batch = (sp.get("batch") ?? SDRM_BATCH_DEFAULT).trim().toLowerCase();

  try {
    const pool = getRimecPool();
    const preview = await previewMapaSdrmPilares(pool, batch, tipoV2Id);
    return NextResponse.json({ ok: true, preview });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error en vista previa" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const gate = await requirePilaresAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "BD no configurada" }, { status: 503 });
  }

  const body = (await req.json()) as { batch?: string; tipo_v2_id?: number; dry_run?: boolean };
  const tipoV2Id = parseTipoV2Id(body.tipo_v2_id != null ? String(body.tipo_v2_id) : "1");
  const batch = (body.batch ?? SDRM_BATCH_DEFAULT).trim().toLowerCase();

  try {
    const pool = getRimecPool();
    if (body.dry_run) {
      const preview = await previewMapaSdrmPilares(pool, batch, tipoV2Id);
      return NextResponse.json({ ok: true, preview, applied: null });
    }
    const applied = await aplicarMapaSdrmPilares(pool, batch, tipoV2Id);
    const preview = await previewMapaSdrmPilares(pool, batch, tipoV2Id);
    return NextResponse.json({ ok: true, preview, applied });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error al aplicar mapa" },
      { status: 500 },
    );
  }
}
