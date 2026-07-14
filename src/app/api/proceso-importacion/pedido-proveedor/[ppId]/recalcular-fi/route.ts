import { NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { recalcularFisPp } from "@/lib/pedido-proveedor/recalcular-fis-pp";
import { runRecalcularFiPython } from "@/lib/pedido-proveedor/run-python-listado";

type Params = { params: Promise<{ ppId: string }> };

function shouldUseTsRecalcFi(): boolean {
  return process.env.VERCEL === "1" || process.env.PP_VINCULAR_USE_TS === "1";
}

export async function POST(req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  const ppId = Number((await params).ppId);
  if (!Number.isFinite(ppId)) {
    return NextResponse.json({ ok: false, error: "PP inválido" }, { status: 400 });
  }

  let body: { incluir_confirmadas?: boolean; incluir_vendidos?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* default opts */
  }

  const incluirConfirmadas = Boolean(body.incluir_confirmadas);

  if (shouldUseTsRecalcFi()) {
    const result = await recalcularFisPp(ppId, { incluirConfirmadas });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      message: result.message,
      stats: result.stats,
    });
  }

  const result = await runRecalcularFiPython(
    ppId,
    incluirConfirmadas,
    Boolean(body.incluir_vendidos),
  );

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error ?? result.message ?? "Error al recalcular" },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, message: result.message, stats: result.stats });
}
