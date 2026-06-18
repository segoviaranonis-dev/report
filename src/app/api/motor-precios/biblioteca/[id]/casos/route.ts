import { NextRequest, NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { crearCasoBiblioteca } from "@/lib/motor-precios/biblioteca-editor";
import { descuentosDesdePct } from "@/lib/motor-precios/caso-utils";
import { MOTOR_PROVEEDOR_DEFAULT } from "@/lib/motor-precios/constants";
import { parseCodigosLineaTexto } from "@/lib/motor-precios/lineas-texto";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const { id } = await ctx.params;
  const bibliotecaId = Number(id);

  let body: {
    nombre_caso?: string;
    dolar_politica?: number;
    factor_conversion?: number;
    d1?: number;
    d2?: number;
    d3?: number;
    d4?: number;
    genera_lpc03_lpc04?: boolean;
    lineas_texto?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const desc = descuentosDesdePct(body.d1 ?? 0, body.d2 ?? 0, body.d3 ?? 0, body.d4 ?? 0);
  const parsed = body.lineas_texto ? parseCodigosLineaTexto(body.lineas_texto) : { ok: [], errores: [] };
  if (parsed.errores.length) {
    return NextResponse.json({ ok: false, error: parsed.errores.join("; ") }, { status: 400 });
  }

  try {
    const pool = getRimecPool();
    const casoId = await crearCasoBiblioteca(
      pool,
      bibliotecaId,
      MOTOR_PROVEEDOR_DEFAULT,
      {
        nombre_caso: body.nombre_caso,
        dolar_politica: body.dolar_politica,
        factor_conversion: body.factor_conversion,
        ...desc,
        genera_lpc03_lpc04: body.genera_lpc03_lpc04 !== false,
      },
      parsed.ok,
    );
    return NextResponse.json({ ok: true, caso_id: casoId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al crear caso";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
