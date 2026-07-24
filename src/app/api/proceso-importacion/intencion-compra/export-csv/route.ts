import { NextResponse } from "next/server";
import {
  buildIcPendientesCsv,
  icPendientesCsvFilename,
} from "@/lib/intencion-compra/ic-csv-export";
import { listIcPendientes } from "@/lib/intencion-compra/pendientes-query";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const url = new URL(req.url);
  const proveedor = (url.searchParams.get("proveedor") ?? "").trim().toLowerCase();

  try {
    const pool = getRimecPool();
    let ics = await listIcPendientes(pool);
    if (proveedor) {
      ics = ics.filter((ic) => ic.proveedor.toLowerCase().includes(proveedor));
    }
    const csv = buildIcPendientesCsv(ics);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${icPendientesCsvFilename()}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al generar CSV";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
