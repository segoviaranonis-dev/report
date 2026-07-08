import { NextRequest, NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { auditarPreviewEvento } from "@/lib/motor-precios/evento-preview-audit";
import { getPrecioEventoDetalle } from "@/lib/motor-precios/evento-queries";
import { asignarLineasPreviewACaso } from "@/lib/motor-precios/preview-asignar-lineas";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Params = { params: Promise<{ id: string }> };

/**
 * Preview operativo — asigna códigos pilar línea al caso en biblioteca (BCL)
 * y sincroniza precio_evento_linea_excepcion del evento.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const eventoId = Number((await params).id);
  if (!Number.isFinite(eventoId) || eventoId <= 0) {
    return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  }

  let body: {
    caso_evento_id?: number;
    lineas?: string[];
    marca_por_linea?: Record<string, string>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const casoEventoId = Number(body.caso_evento_id);
  const lineas = Array.isArray(body.lineas) ? body.lineas.map(String) : [];
  if (!Number.isFinite(casoEventoId) || casoEventoId <= 0) {
    return NextResponse.json({ ok: false, error: "caso_evento_id requerido" }, { status: 400 });
  }
  if (!lineas.length) {
    return NextResponse.json({ ok: false, error: "lineas requerido (códigos pilar línea)" }, { status: 400 });
  }

  const pool = getRimecPool();

  const evento = await getPrecioEventoDetalle(pool, eventoId);
  if (!evento) {
    return NextResponse.json({ ok: false, error: "Evento no encontrado" }, { status: 404 });
  }
  if (String(evento.estado).toLowerCase() === "cerrado") {
    return NextResponse.json({ ok: false, error: "Evento cerrado" }, { status: 409 });
  }
  const bibliotecaId = evento.biblioteca_precio_id;
  if (!bibliotecaId) {
    return NextResponse.json({ ok: false, error: "Sin biblioteca — Paso Memoria primero" }, { status: 422 });
  }

  const casoOk = evento.matriz.casos.some((c) => c.id === casoEventoId);
  if (!casoOk) {
    return NextResponse.json({ ok: false, error: "Caso no pertenece al evento" }, { status: 422 });
  }

  try {
    const result = await asignarLineasPreviewACaso(pool, {
      eventoId,
      proveedorId: evento.proveedor_id,
      bibliotecaId,
      casoEventoId,
      lineasCodigo: lineas,
      marcaPorLinea: body.marca_por_linea ?? {},
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
    }

    const audit = await auditarPreviewEvento(pool, eventoId);
    const eventoRefreshed = await getPrecioEventoDetalle(pool, eventoId);

    return NextResponse.json({
      ok: true,
      lineas: result.lineas,
      caso_biblioteca_id: result.caso_biblioteca_id,
      caso_evento_id: result.caso_evento_id,
      audit,
      evento: eventoRefreshed,
    });
  } catch (e) {
    console.error("[POST asignar-lineas-preview]", e);
    const msg = e instanceof Error ? e.message : "Error al asignar líneas";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
