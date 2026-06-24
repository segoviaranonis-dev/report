import { NextResponse } from "next/server";
import { loadIcCatalogos } from "@/lib/intencion-compra/catalogos-query";
import { listIcDevueltas } from "@/lib/intencion-compra/pendientes-query";
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
      listIcDevueltas(pool),
      loadIcCatalogos(pool),
      loadQuincenasArribo(pool),
    ]);
    return NextResponse.json({
      ok: true,
      total: ics.length,
      ics,
      catalogos,
      quincena_lookup: quincenasToLookup(quincenas),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
