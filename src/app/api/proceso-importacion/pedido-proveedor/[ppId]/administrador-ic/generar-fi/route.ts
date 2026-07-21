import { NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { generarFiDesdeAdministradorIc } from "@/lib/pedido-proveedor/administrador-ic-generar-fi";
import { getPpDetalle } from "@/lib/pedido-proveedor/detail-query";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { syncLogisticaPpIfBandera } from "@/lib/logistica-ok/sync-pp";
import { CATEGORIA_PROGRAMADO_ID } from "@/lib/intencion-compra/categoria-ic";

type Params = { params: Promise<{ ppId: string }> };

/** Genera FI real desde pareja IC + PPD (Administrador IC). */
export async function POST(req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const ppId = Number((await params).ppId);
  if (!Number.isFinite(ppId)) {
    return NextResponse.json({ ok: false, error: "PP inválido" }, { status: 400 });
  }

  const pool = getRimecPool();
  const header = await getPpDetalle(pool, ppId);
  if (!header) {
    return NextResponse.json({ ok: false, error: "PP no encontrado" }, { status: 404 });
  }
  if (header.categoria_id !== CATEGORIA_PROGRAMADO_ID) {
    return NextResponse.json({ ok: false, error: "Solo PP PROGRAMADO" }, { status: 400 });
  }

  let body: { ic_id?: number; ppd_ids?: number[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const icId = Number(body.ic_id);
  const ppdIds = Array.isArray(body.ppd_ids)
    ? [...new Set(body.ppd_ids.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))]
    : [];

  if (!Number.isFinite(icId)) {
    return NextResponse.json({ ok: false, error: "ic_id obligatorio" }, { status: 400 });
  }

  const result = await generarFiDesdeAdministradorIc(pool, ppId, icId, ppdIds);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  try {
    await syncLogisticaPpIfBandera(pool, ppId);
  } catch {
    /* bandera off o MIG pendiente */
  }
  return NextResponse.json(result);
}
