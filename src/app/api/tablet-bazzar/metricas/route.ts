import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { assertClienteIdAccess, resolveCajaAccess } from "@/lib/caja-bazzar/access";
import { isCajaClienteId } from "@/lib/caja-bazzar/tiendas";
import { queryMetricasTienda } from "@/lib/caja-bazzar/empaque-db";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";

function parseClienteIdParam(raw: string | null): number | null {
  if (!raw?.trim()) return null;
  const n = Number(raw.trim());
  return Number.isFinite(n) && isCajaClienteId(n) ? n : null;
}

/** GET /api/tablet-bazzar/metricas?cliente_id= */
export async function GET(req: NextRequest) {
  const session = await getSession();
  const access = resolveCajaAccess(session);
  if (!access.ok) return access.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false, error: "Base de datos no configurada" });
  }

  const clienteId = parseClienteIdParam(req.nextUrl.searchParams.get("cliente_id"));
  if (clienteId == null) {
    return NextResponse.json({ error: "cliente_id requerido" }, { status: 400 });
  }

  const denied = assertClienteIdAccess(access, clienteId);
  if (denied) return denied.error;

  try {
    const metricas = await queryMetricasTienda(clienteId);
    return NextResponse.json({ ok: true, ...metricas });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error métricas";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
