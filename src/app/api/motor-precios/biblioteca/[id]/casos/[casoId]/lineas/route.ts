import { NextRequest, NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import {
  loadBibliotecaEditor,
  persistirLineasCaso,
  validarLineasParaCaso,
} from "@/lib/motor-precios/biblioteca-editor";
import { MOTOR_PROVEEDOR_DEFAULT } from "@/lib/motor-precios/constants";
import { parseCodigosLineaTexto } from "@/lib/motor-precios/lineas-texto";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Ctx = { params: Promise<{ id: string; casoId: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const { id, casoId } = await ctx.params;
  const bibliotecaId = Number(id);
  const cid = Number(casoId);

  let body: { lineas_texto?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const parsed = parseCodigosLineaTexto(body.lineas_texto ?? "");
  if (parsed.errores.length) {
    return NextResponse.json({ ok: false, error: parsed.errores.join("; ") }, { status: 400 });
  }

  try {
    const pool = getRimecPool();
    const val = await validarLineasParaCaso(
      pool,
      bibliotecaId,
      cid,
      MOTOR_PROVEEDOR_DEFAULT,
      parsed.ok,
    );
    if (!val.ok) {
      return NextResponse.json({ ok: false, error: val.error }, { status: 400 });
    }

    const codigos = val.codigos ?? parsed.ok;
    const n = await persistirLineasCaso(pool, bibliotecaId, cid, MOTOR_PROVEEDOR_DEFAULT, codigos);

    const editor = await loadBibliotecaEditor(pool, bibliotecaId, MOTOR_PROVEEDOR_DEFAULT);
    const caso = editor?.casos.find((c) => c.id === cid);

    return NextResponse.json({
      ok: true,
      lineas_guardadas: caso?.lineas.length ?? n,
      lineas: caso?.lineas ?? codigos,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al guardar líneas";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
