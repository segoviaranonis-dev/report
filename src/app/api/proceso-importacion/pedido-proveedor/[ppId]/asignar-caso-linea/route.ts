import { NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { asignarLineasPreviewACaso } from "@/lib/motor-precios/preview-asignar-lineas";
import { listarCasosEventoParaAsignacion } from "@/lib/motor-precios/caso-linea-evento";
import { getPrecioEventoDetalle } from "@/lib/motor-precios/evento-queries";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { CATEGORIA_PROGRAMADO_ID } from "@/lib/intencion-compra/categoria-ic";
import { getPpDetalle } from "@/lib/pedido-proveedor/detail-query";

type Params = { params: Promise<{ ppId: string }> };

/** Asigna código(s) pilar línea → caso del evento vinculado al PP (sin exigir precio). */
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

  let body: { caso_evento_id?: number; lineas?: string[]; marca_por_linea?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const pool = getRimecPool();
  const header = await getPpDetalle(pool, ppId);
  if (!header || header.categoria_id !== CATEGORIA_PROGRAMADO_ID) {
    return NextResponse.json({ ok: false, error: "PP PROGRAMADO no encontrado" }, { status: 404 });
  }

  const evRes = await pool.query<{ evento_id: number | null; proveedor_id: number | null }>(
    `SELECT icp.precio_evento_id::int AS evento_id, pp.proveedor_importacion_id::int AS proveedor_id
     FROM intencion_compra_pedido icp
     JOIN pedido_proveedor pp ON pp.id = icp.pedido_proveedor_id
     WHERE icp.pedido_proveedor_id = $1 AND icp.precio_evento_id IS NOT NULL
     ORDER BY icp.id LIMIT 1`,
    [ppId],
  );
  const eventoId = evRes.rows[0]?.evento_id;
  const proveedorId = evRes.rows[0]?.proveedor_id ?? 654;
  if (!eventoId) {
    return NextResponse.json({ ok: false, error: "PP sin evento de precios vinculado" }, { status: 422 });
  }

  const casoEventoId = Number(body.caso_evento_id);
  const lineas = Array.isArray(body.lineas) ? body.lineas.map(String) : [];
  if (!Number.isFinite(casoEventoId) || !lineas.length) {
    return NextResponse.json({ ok: false, error: "caso_evento_id y lineas[] requeridos" }, { status: 400 });
  }

  const evento = await getPrecioEventoDetalle(pool, eventoId);
  if (!evento?.biblioteca_precio_id) {
    return NextResponse.json({ ok: false, error: "Evento sin biblioteca" }, { status: 422 });
  }

  const result = await asignarLineasPreviewACaso(pool, {
    eventoId,
    proveedorId,
    bibliotecaId: evento.biblioteca_precio_id,
    casoEventoId,
    lineasCodigo: lineas,
    marcaPorLinea: body.marca_por_linea ?? {},
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
  }

  return NextResponse.json({
    ok: true,
    evento_id: eventoId,
    lineas: result.lineas,
    message: `Línea(s) ${lineas.join(", ")} asignadas al caso — recalculá precio_lista si hace falta LPN.`,
  });
}

/** Lista casos del evento del PP (para UI asignación línea → caso). */
export async function GET(_req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  const ppId = Number((await params).ppId);
  const pool = getRimecPool();
  const evRes = await pool.query<{ evento_id: number | null }>(
    `SELECT icp.precio_evento_id::int AS evento_id
     FROM intencion_compra_pedido icp
     WHERE icp.pedido_proveedor_id = $1 AND icp.precio_evento_id IS NOT NULL
     ORDER BY icp.id LIMIT 1`,
    [ppId],
  );
  const eventoId = evRes.rows[0]?.evento_id;
  if (!eventoId) {
    return NextResponse.json({ ok: false, error: "Sin evento vinculado" }, { status: 422 });
  }
  const casos = await listarCasosEventoParaAsignacion(pool, eventoId);
  return NextResponse.json({ ok: true, evento_id: eventoId, casos });
}
