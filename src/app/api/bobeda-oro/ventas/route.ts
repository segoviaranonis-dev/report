import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { assertClienteIdAccess, resolveBobedaAccess } from "@/lib/bobeda-oro/access";
import { listBobedaVentas } from "@/lib/bobeda-oro/queries";
import { isCajaClienteId } from "@/lib/caja-bazzar/tiendas";

export async function GET(req: NextRequest) {
  const session = await getSession();
  const access = resolveBobedaAccess(session);
  if (!access.ok) return access.error;

  const sp = req.nextUrl.searchParams;
  const clienteRaw = sp.get("cliente_id");
  const clienteId = clienteRaw ? Number(clienteRaw) : undefined;
  if (clienteId != null && Number.isFinite(clienteId)) {
    const denied = assertClienteIdAccess(access, clienteId);
    if (denied) return denied.error;
  }

  const fiFaRaw = sp.get("fi_fa");
  const stagingRaw = sp.get("staging_id");
  const limitRaw = Number(sp.get("limit") ?? "100");
  const offsetRaw = Number(sp.get("offset") ?? "0");

  try {
    const body = await listBobedaVentas({
      allowedClienteIds: access.allowedClienteIds,
      clienteId: clienteId != null && Number.isFinite(clienteId) && isCajaClienteId(clienteId) ? clienteId : undefined,
      estado: sp.get("estado") ?? undefined,
      origen: sp.get("origen") ?? undefined,
      desde: sp.get("desde") ?? undefined,
      hasta: sp.get("hasta") ?? undefined,
      marca: sp.get("marca") ?? undefined,
      vendedor: sp.get("vendedor") ?? undefined,
      cedula: sp.get("cedula") ?? undefined,
      facturaLegal: sp.get("factura_legal") ?? undefined,
      fiFa: fiFaRaw ? Number(fiFaRaw) : undefined,
      stagingId: stagingRaw ? Number(stagingRaw) : undefined,
      q: sp.get("q") ?? undefined,
      limit: Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 100,
      offset: Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0,
    });
    return NextResponse.json(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error consultando bóveda";
    return NextResponse.json({ configured: true, rows: [], total: 0, pares: 0, monto_total: 0, error: msg }, { status: 500 });
  }
}
