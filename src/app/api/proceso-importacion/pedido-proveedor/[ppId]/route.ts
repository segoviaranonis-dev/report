import { NextResponse } from "next/server";
import { cerrarPp } from "@/lib/digitacion/actions";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getPpDetalle, listAlaNortePp, listFacturasInternasPp, listIcsVinculadasPp } from "@/lib/pedido-proveedor/detail-query";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Params = { params: Promise<{ ppId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const ppId = Number((await params).ppId);
  if (!Number.isFinite(ppId)) {
    return NextResponse.json({ ok: false, error: "PP inválido" }, { status: 400 });
  }

  try {
    const pool = getRimecPool();
    const header = await getPpDetalle(pool, ppId);
    if (!header) {
      return NextResponse.json({ ok: false, error: "PP no encontrado" }, { status: 404 });
    }
    const ics = await listIcsVinculadasPp(pool, ppId);
    const alaNorte = await listAlaNortePp(pool, ppId);
    const facturas = await listFacturasInternasPp(pool, ppId);
    return NextResponse.json({ ok: true, pp: header, ics, alaNorte, facturas });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const ppId = Number((await params).ppId);
  let body: { nro_factura_importacion?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const result = await cerrarPp(getRimecPool(), ppId, body.nro_factura_importacion ?? "");
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
