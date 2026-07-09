import { NextResponse } from "next/server";
import { getIcAsignacion, listPpsAbiertosSelector } from "@/lib/digitacion/bandeja-query";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { loadIcCatalogos } from "@/lib/intencion-compra/catalogos-query";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Params = { params: Promise<{ icId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const icId = Number((await params).icId);
  if (!Number.isFinite(icId)) {
    return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
  }

  try {
    const pool = getRimecPool();
    const ic = await getIcAsignacion(pool, icId);
    if (!ic) return NextResponse.json({ ok: false, error: "IC no disponible para asignación" }, { status: 404 });

    const catalogos = await loadIcCatalogos(pool);
    const ppsAbiertos = await listPpsAbiertosSelector(pool, ic.categoria_id);

    return NextResponse.json({ ok: true, ic, catalogos, pps_abiertos: ppsAbiertos });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
