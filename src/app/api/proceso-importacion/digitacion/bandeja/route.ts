import { NextResponse } from "next/server";
import {
  listIcPendientesDigitacion,
  listPpsDigitacionCerrados,
  listPpsEnProceso,
} from "@/lib/digitacion/bandeja-query";
import type { RamoDigitacion } from "@/lib/intencion-compra/categoria-ic";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

function parseRamo(value: string | null): RamoDigitacion {
  return value === "programado" ? "programado" : "compra_previa";
}

export async function GET(req: Request) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const url = new URL(req.url);
  const ramo = parseRamo(url.searchParams.get("ramo"));

  try {
    const pool = getRimecPool();
    const pendientes = await listIcPendientesDigitacion(pool, ramo);
    const enProceso = await listPpsEnProceso(pool, ramo);
    const cerrados = await listPpsDigitacionCerrados(pool, ramo);
    const pendientesCp = await listIcPendientesDigitacion(pool, "compra_previa");
    const pendientesProg = await listIcPendientesDigitacion(pool, "programado");

    const totalPares = pendientes.reduce((s, ic) => s + ic.pares, 0);

    return NextResponse.json({
      ok: true,
      ramo,
      pendientes,
      en_proceso: enProceso,
      cerrados_digitacion: cerrados,
      stats: {
        pendientes: pendientes.length,
        total_pares: totalPares,
        compra_previa: pendientesCp.length,
        programado: pendientesProg.length,
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
