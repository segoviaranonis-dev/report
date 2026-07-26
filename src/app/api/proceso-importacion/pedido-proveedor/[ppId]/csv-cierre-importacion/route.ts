import { NextResponse } from "next/server";
import {
  buildIcCierreImportacionCsv,
  cierreImportacionCsvFilename,
  listIcCierreImportacionRows,
} from "@/lib/pedido-proveedor/ic-cierre-importacion-csv";
import { getPpDetalle } from "@/lib/pedido-proveedor/detail-query";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ ppId: string }> };

/** CSV cierre importación — IC + Factura Real (Carlos) · antes de Compras */
export async function GET(_req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const ppId = Number((await params).ppId);
  if (!Number.isFinite(ppId)) {
    return NextResponse.json({ ok: false, error: "PP inválido" }, { status: 400 });
  }

  const pool = getRimecPool();
  const header = await getPpDetalle(pool, ppId);
  if (!header) {
    return NextResponse.json({ ok: false, error: "PP no encontrado" }, { status: 404 });
  }

  try {
    const rows = await listIcCierreImportacionRows(pool, ppId);
    const csv = buildIcCierreImportacionCsv(rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${cierreImportacionCsvFilename(header.numero_registro)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al generar CSV cierre";
    console.error("[csv-cierre-importacion]", msg, e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
