import { NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { icApiErrorResponse } from "@/lib/intencion-compra/ic-api-error";
import { recalcularFisPp } from "@/lib/pedido-proveedor/recalcular-fis-pp";
import { runVincularListadoPython } from "@/lib/pedido-proveedor/run-python-listado";
import { vincularListadoAPp } from "@/lib/pedido-proveedor/stock-listado";
import { formatCertificacionPreciosCp } from "@/lib/pedido-proveedor/certificar-precios-cp";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Params = { params: Promise<{ ppId: string }> };

function shouldUseTsVincularListado(): boolean {
  return process.env.VERCEL === "1" || process.env.PP_VINCULAR_USE_TS === "1";
}

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

  let body: {
    evento_id?: number;
    recalcular_fi?: boolean;
    incluir_confirmadas?: boolean;
    incluir_vendidos?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const eventoId = Number(body.evento_id);
  if (!Number.isFinite(eventoId)) {
    return NextResponse.json({ ok: false, error: "evento_id inválido" }, { status: 400 });
  }

  const incluirVendidos = Boolean(body.incluir_vendidos);
  const recalcularFi = body.recalcular_fi !== false;
  const incluirConfirmadas = Boolean(body.incluir_confirmadas);

  try {
    if (shouldUseTsVincularListado()) {
      const result = await vincularListadoAPp(
        getRimecPool(),
        ppId,
        eventoId,
        gate.session?.id_usuario ?? null,
        incluirVendidos,
      );
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
      }

      let recalcStats = null;
      let recalcMessage: string | undefined;
      if (recalcularFi) {
        const recalc = await recalcularFisPp(ppId, { incluirConfirmadas });
        if (!recalc.ok) {
          return NextResponse.json(
            {
              ok: false,
              error: `Listado vinculado pero falló recalc FI: ${recalc.error}`,
              partial: { snapshot: result.detalle, actualizados: result.actualizados },
            },
            { status: 500 },
          );
        }
        recalcStats = recalc.stats;
        recalcMessage = recalc.message;
      }

      return NextResponse.json({
        ok: true,
        message: recalcMessage
          ?? (incluirVendidos
            ? "Listado vinculado — PPD TODOS (incl. vendidos)."
            : "Listado vinculado — solo tránsito (motor TS)"),
        stats: {
          snapshot: { ...(result.detalle ?? {}), actualizados: result.actualizados ?? 0 },
          certificacion: result.certificacion ?? null,
          ...recalcStats,
        },
        certificacion: result.certificacion ?? null,
        certificacion_ok: result.certificacion?.ok ?? null,
        certificacion_msg: result.certificacion
          ? formatCertificacionPreciosCp(result.certificacion)
          : undefined,
        actualizados: result.actualizados,
      });
    }

    const result = await runVincularListadoPython(ppId, eventoId, {
      recalcularFi: body.recalcular_fi !== false,
      incluirConfirmadas: Boolean(body.incluir_confirmadas),
      incluirVendidos,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error ?? result.message ?? "Error al vincular" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: result.message,
      stats: result.stats,
      actualizados: result.stats?.snapshot?.actualizados,
    });
  } catch (e) {
    return icApiErrorResponse(e, "Error al vincular listado");
  }
}
