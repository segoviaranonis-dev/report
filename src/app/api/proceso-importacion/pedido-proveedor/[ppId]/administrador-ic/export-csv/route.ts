import { NextResponse } from "next/server";
import { loadAdministradorIcPp } from "@/lib/pedido-proveedor/administrador-ic-query";
import { buildIcPpCsvExport, icPpCsvFilename } from "@/lib/pedido-proveedor/ic-pp-csv-export";
import { getPpDetalle } from "@/lib/pedido-proveedor/detail-query";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { CATEGORIA_PROGRAMADO_ID } from "@/lib/intencion-compra/categoria-ic";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ ppId: string }> };

export async function GET(req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const ppId = Number((await params).ppId);
  if (!Number.isFinite(ppId)) {
    return NextResponse.json({ ok: false, error: "PP inválido" }, { status: 400 });
  }

  const url = new URL(req.url);
  const clienteRaw = url.searchParams.get("cliente_id");
  const clienteId = clienteRaw != null && clienteRaw !== "" ? Number(clienteRaw) : null;

  const pool = getRimecPool();
  const header = await getPpDetalle(pool, ppId);
  if (!header) {
    return NextResponse.json({ ok: false, error: "PP no encontrado" }, { status: 404 });
  }
  if (header.categoria_id !== CATEGORIA_PROGRAMADO_ID) {
    return NextResponse.json(
      { ok: false, error: "Export IC solo aplica a PP PROGRAMADO" },
      { status: 400 },
    );
  }

  try {
    const data = await loadAdministradorIcPp(pool, ppId);
    const csv = buildIcPpCsvExport(header, data, {
      clienteId: Number.isFinite(clienteId) ? clienteId : null,
    });
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${icPpCsvFilename(header.numero_registro)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al generar CSV";
    console.error("[administrador-ic/export-csv]", msg, e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
