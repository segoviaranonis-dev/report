import { NextResponse } from "next/server";
import { loadIcCatalogos } from "@/lib/intencion-compra/catalogos-query";
import { listIcPendientes } from "@/lib/intencion-compra/pendientes-query";
import { loadQuincenasArribo, quincenasToLookup } from "@/lib/intencion-compra/quincena-arribo";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export async function GET() {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  try {
    const pool = getRimecPool();
    const [ics, catalogos, quincenas] = await Promise.all([
      listIcPendientes(pool),
      loadIcCatalogos(pool),
      loadQuincenasArribo(pool),
    ]);

    const totalPares = ics.reduce((s, ic) => s + ic.pares, 0);
    const totalNeto = ics.reduce((s, ic) => s + ic.monto_neto, 0);

    return NextResponse.json({
      ok: true,
      total: ics.length,
      stats: { pares: totalPares, neto: totalNeto },
      ics,
      catalogos,
      quincenas,
      quincena_lookup: quincenasToLookup(quincenas),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al cargar pendientes";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
