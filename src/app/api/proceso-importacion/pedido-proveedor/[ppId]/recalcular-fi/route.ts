import { NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { runRecalcularFiPython } from "@/lib/pedido-proveedor/run-python-listado";

type Params = { params: Promise<{ ppId: string }> };

export async function POST(req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  const ppId = Number((await params).ppId);
  if (!Number.isFinite(ppId)) {
    return NextResponse.json({ ok: false, error: "PP inválido" }, { status: 400 });
  }

  let body: { incluir_confirmadas?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* default opts */
  }

  const result = await runRecalcularFiPython(ppId, Boolean(body.incluir_confirmadas));

  if (process.env.VERCEL === "1" && !result.ok && String(result.error ?? "").includes("ENOENT")) {
    return NextResponse.json(
      {
        ok: false,
        error: "Recalcular FI no disponible en prod (sin Python). Usá «Crear facturas internas» en tab FI.",
      },
      { status: 400 },
    );
  }

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? result.message ?? "Error al recalcular" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, message: result.message, stats: result.stats });
}
