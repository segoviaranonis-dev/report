import { NextResponse } from "next/server";
import { confirmarFi } from "@/app/aprobaciones/lib/aprobaciones-mutations";
import { requireNivelDiosAction } from "@/app/aprobaciones/lib/require-nivel-dios";

/** POST — confirmar FI RESERVADA (sin re-render SSR pesado de server action). */
export async function POST(
  _request: Request,
  props: { params: Promise<{ fi_id: string }> },
) {
  try {
    const gate = await requireNivelDiosAction();
    if (!gate.ok) {
      return NextResponse.json({ ok: false, msg: gate.error }, { status: 403 });
    }

    const params = await props.params;
    const fiId = parseInt(params.fi_id, 10);
    if (!Number.isFinite(fiId)) {
      return NextResponse.json({ ok: false, msg: "ID inválido" }, { status: 400 });
    }

    const result = await confirmarFi(fiId);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    console.error("[aprobaciones/confirmar]", err);
    return NextResponse.json(
      { ok: false, msg: err instanceof Error ? err.message : "Error interno" },
      { status: 500 },
    );
  }
}
