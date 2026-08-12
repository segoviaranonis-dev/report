import { after, NextResponse } from "next/server";
import {
  aprobacionGeneral,
  syncLogisticaTrasConfirmarFiBackground,
} from "@/app/aprobaciones/lib/aprobaciones-mutations";
import { requireNivelDiosAction } from "@/app/aprobaciones/lib/require-nivel-dios";

/**
 * POST — Aprobación Gral: confirma todas las FI RESERVADA de los pedidos
 * PENDIENTE indicados (misma ruta que ✓ Aprobar individual + logística after).
 */
export async function POST(request: Request) {
  try {
    const gate = await requireNivelDiosAction();
    if (!gate.ok) {
      return NextResponse.json({ ok: false, msg: gate.error }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as {
      pedidoIds?: unknown;
    } | null;
    const pedidoIds = Array.isArray(body?.pedidoIds)
      ? body!.pedidoIds.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
      : [];

    if (pedidoIds.length === 0) {
      return NextResponse.json(
        { ok: false, msg: "Indicá al menos un pedido pendiente." },
        { status: 400 },
      );
    }

    const result = await aprobacionGeneral(pedidoIds);

    if (result.logisticaQueue.length > 0) {
      const queue = result.logisticaQueue;
      after(async () => {
        for (const { fiId, ppId } of queue) {
          await syncLogisticaTrasConfirmarFiBackground(fiId, ppId);
        }
      });
    }

    return NextResponse.json(result, {
      status: result.ok ? 200 : result.fisOk > 0 ? 207 : 400,
    });
  } catch (err) {
    console.error("[aprobaciones/aprobacion-general]", err);
    return NextResponse.json(
      { ok: false, msg: err instanceof Error ? err.message : "Error interno" },
      { status: 500 },
    );
  }
}
