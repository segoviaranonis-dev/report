import { NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { exportCsvPreciosPp } from "@/lib/pedido-proveedor/csv-precios-export";
import { getPpDetalle } from "@/lib/pedido-proveedor/detail-query";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Params = { params: Promise<{ ppId: string }> };

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

  const programado = header.categoria_id === 3;
  const tieneFilas = programado
    ? header.n_facturas_internas > 0
    : header.n_fi_confirmadas > 0;

  if (!tieneFilas) {
    return NextResponse.json(
      {
        ok: false,
        error: programado
          ? "Sin FI — importá proforma primero"
          : "Sin FI confirmadas — CSV precios no disponible",
      },
      { status: 400 },
    );
  }

  try {
    const { content, filename } = await exportCsvPreciosPp(pool, ppId, {
      numeroRegistro: header.numero_registro,
      categoriaId: header.categoria_id,
    });
    return new NextResponse(Buffer.from(content, "utf-8"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error generando CSV precios";
    console.error("[csv-precios]", msg, e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
