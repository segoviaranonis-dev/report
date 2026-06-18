import { NextRequest, NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { updateCasoBiblioteca } from "@/lib/motor-precios/biblioteca-editor";
import { descuentosDesdePct } from "@/lib/motor-precios/caso-utils";
import { MOTOR_PROVEEDOR_DEFAULT } from "@/lib/motor-precios/constants";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Ctx = { params: Promise<{ id: string; casoId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const { id, casoId } = await ctx.params;
  const bibliotecaId = Number(id);
  const cid = Number(casoId);

  let body: {
    nombre_caso?: string;
    dolar_politica?: number;
    factor_conversion?: number;
    d1?: number;
    d2?: number;
    d3?: number;
    d4?: number;
    genera_lpc03_lpc04?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const desc = descuentosDesdePct(body.d1 ?? 0, body.d2 ?? 0, body.d3 ?? 0, body.d4 ?? 0);

  try {
    const pool = getRimecPool();
    await updateCasoBiblioteca(pool, bibliotecaId, MOTOR_PROVEEDOR_DEFAULT, cid, {
      nombre_caso: body.nombre_caso,
      dolar_politica: body.dolar_politica,
      factor_conversion: body.factor_conversion,
      ...desc,
      genera_lpc03_lpc04: body.genera_lpc03_lpc04 !== false,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al guardar caso";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
