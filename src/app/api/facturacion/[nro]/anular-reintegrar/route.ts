import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isNivelDios, mensajeAccesoNivelDios } from "@/lib/auth/nivel-dios";
import { anularYReintegrarFiPorNro } from "@/lib/facturacion/anular-reintegrar-fi";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Ctx = { params: Promise<{ nro: string }> };

/** POST — Nivel Dios · anular FI entera + reintegrar stock (2.3.1.9.C) */
export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!isNivelDios(session)) {
    return NextResponse.json({ error: mensajeAccesoNivelDios() }, { status: 403 });
  }

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const { nro } = await ctx.params;
  const decoded = decodeURIComponent(nro);

  let motivo = "";
  try {
    const body = (await req.json()) as { motivo?: string };
    motivo = String(body.motivo ?? "").trim();
  } catch {
    return NextResponse.json({ error: "JSON inválido · motivo requerido" }, { status: 400 });
  }

  const result = await anularYReintegrarFiPorNro(decoded, {
    permitirConfirmada: true,
    motivo,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.msg }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: result.msg,
    stats: {
      fi_id: result.fi_id,
      nro_factura: result.nro_factura,
      estado_previo: result.estado_previo,
      pares_reintegrados_ppd: result.pares_reintegrados_ppd,
      lineas_ppd: result.lineas_ppd,
      lineas_sin_ppd: result.lineas_sin_ppd,
    },
  });
}
