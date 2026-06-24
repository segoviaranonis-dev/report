import { NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { proveedorIdFromTipoV2 } from "@/lib/pilares/constants";
import { loadMarcasForTipoV2 } from "@/lib/pilares/queries";
import type { TipoV2Id } from "@/lib/pilares/types";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export async function GET(req: Request) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const url = new URL(req.url);
  const tipoId = Number(url.searchParams.get("tipo_id"));
  if (!Number.isFinite(tipoId) || tipoId < 1) {
    return NextResponse.json({ ok: false, error: "tipo_id obligatorio" }, { status: 400 });
  }

  const provParam = url.searchParams.get("proveedor_id");
  const proveedorId =
    provParam && Number.isFinite(Number(provParam)) && Number(provParam) > 0
      ? Number(provParam)
      : proveedorIdFromTipoV2(tipoId) ?? 654;

  try {
    const marcas = await loadMarcasForTipoV2(getRimecPool(), tipoId as TipoV2Id, proveedorId);
    return NextResponse.json({ ok: true, marcas });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
