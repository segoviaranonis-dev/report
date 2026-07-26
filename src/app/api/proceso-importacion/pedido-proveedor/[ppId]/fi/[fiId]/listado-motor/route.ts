import { NextResponse } from "next/server";
import { icApiErrorResponse } from "@/lib/intencion-compra/ic-api-error";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { actualizarListadoMotorFiDesdePp } from "@/lib/pedido-proveedor/fi-pp-actions";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Params = { params: Promise<{ ppId: string; fiId: string }> };

/** PATCH · Impone evento motor por FI · recalc inmediato · sync Logística OK. */
export async function PATCH(req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const { ppId: ppRaw, fiId: fiRaw } = await params;
  const ppId = Number(ppRaw);
  const fiId = Number(fiRaw);
  if (!Number.isFinite(ppId) || !Number.isFinite(fiId)) {
    return NextResponse.json({ ok: false, error: "IDs inválidos" }, { status: 400 });
  }

  let body: { evento_id?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const eventoId = Number(body.evento_id);
  if (!Number.isFinite(eventoId) || eventoId <= 0) {
    return NextResponse.json({ ok: false, error: "evento_id obligatorio" }, { status: 400 });
  }

  try {
    const result = await actualizarListadoMotorFiDesdePp(getRimecPool(), ppId, fiId, eventoId);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    const r = result.report;
    return NextResponse.json({
      ok: true,
      report: r,
      evento_id: r.evento_id,
      total_monto: r.monto_despues,
      logistica_sync: r.logistica_sync,
      skus_total: r.skus_total,
      skus_ok: r.skus_ok,
      skus_sin_match: r.skus_sin_match,
      skus_sin_cambio_precio: r.skus_sin_cambio_precio,
      skus_cambiados: r.skus_cambiados,
      sin_cambio_precio: r.sin_cambio_precio,
      todos_skus_ok: r.todos_skus_ok,
      hubo_cambio_monto: r.hubo_cambio_monto,
      evento_id_antes: r.evento_id_antes,
      monto_antes: r.monto_antes,
      monto_despues: r.monto_despues,
      delta_monto: r.delta_monto,
      ms_server: r.ms_server,
    });
  } catch (e) {
    return icApiErrorResponse(e, "Error al imponer listado motor en FI");
  }
}
