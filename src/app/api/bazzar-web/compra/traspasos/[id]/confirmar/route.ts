import { NextRequest, NextResponse } from "next/server";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { procesarIngresoBazar } from "@/lib/bazzar-web/compra-web/mutations";

type Params = { params: Promise<{ id: string }> };

/** POST /api/bazzar-web/compra/traspasos/[id]/confirmar — gemelo CONFIRMAR RECEPCIÓN */
export async function POST(_req: NextRequest, { params }: Params) {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
  }

  try {
    const result = await procesarIngresoBazar(id);
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[bazzar-web/compra/confirmar]", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
