import { NextResponse } from "next/server";
import { icApiErrorResponse } from "@/lib/intencion-compra/ic-api-error";
import { cerrarPp } from "@/lib/digitacion/actions";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { patchPpCabecera } from "@/lib/pedido-proveedor/cabecera-actions";
import { syncFiEncabezadoDesdeIc } from "@/lib/pedido-proveedor/fi-pp-actions";
import { getPpDetalle, listAlaNortePp, listFacturasInternasPp, listIcsVinculadasPp } from "@/lib/pedido-proveedor/detail-query";
import { getEventoPpDetalle, listEventosPrecioPp } from "@/lib/pedido-proveedor/stock-listado";
import { fetchFiDetallesBatch } from "@/app/aprobaciones/lib/aprobaciones-queries";
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
    await syncFiEncabezadoDesdeIc(pool, ppId);
    const facturas = await listFacturasInternasPp(pool, ppId);
    const detallesPorFi = await fetchFiDetallesBatch(facturas.map((f) => f.id));
    const eventoDetalle = await getEventoPpDetalle(pool, ppId);
    const eventos = await listEventosPrecioPp(pool, ppId);
    return NextResponse.json({ ok: true, pp: header, ics, alaNorte, facturas, detallesPorFi, eventoDetalle, eventos });
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

  try {
    const result = await cerrarPp(getRimecPool(), ppId, body.nro_factura_importacion ?? "");
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return icApiErrorResponse(e, "Error al cerrar PP");
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const ppId = Number((await params).ppId);
  if (!Number.isFinite(ppId)) {
    return NextResponse.json({ ok: false, error: "PP inválido" }, { status: 400 });
  }

  let body: {
    numero_proforma?: string | null;
    notas?: string | null;
    nro_pedido_externo?: string | null;
    quincena_arribo_id?: number | null;
    descuento_1?: number;
    descuento_2?: number;
    descuento_3?: number;
    descuento_4?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  try {
    const result = await patchPpCabecera(getRimecPool(), ppId, body);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return icApiErrorResponse(e, "Error al actualizar PP");
  }
}
