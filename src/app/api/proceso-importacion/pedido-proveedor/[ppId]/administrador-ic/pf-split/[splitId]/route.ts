import { NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { deletePfSplit } from "@/lib/pedido-proveedor/admin-ic-pf-splits";
import { loadAdministradorIcPp } from "@/lib/pedido-proveedor/administrador-ic-query";
import { getPpDetalle } from "@/lib/pedido-proveedor/detail-query";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { CATEGORIA_PROGRAMADO_ID } from "@/lib/intencion-compra/categoria-ic";

type Params = { params: Promise<{ ppId: string; splitId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const { ppId: ppIdRaw, splitId } = await params;
  const ppId = Number(ppIdRaw);
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

  const del = await deletePfSplit(pool, ppId, splitId);
  if (!del.ok) {
    return NextResponse.json({ ok: false, error: del.error }, { status: 404 });
  }

  const data = await loadAdministradorIcPp(pool, ppId);
  return NextResponse.json({ ok: true, ...data });
}
