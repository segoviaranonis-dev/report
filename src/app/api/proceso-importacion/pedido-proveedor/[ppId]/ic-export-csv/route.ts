import { NextResponse } from "next/server";
import { CATEGORIA_PROGRAMADO_ID } from "@/lib/intencion-compra/categoria-ic";
import { loadAdministradorIcPp } from "@/lib/pedido-proveedor/administrador-ic-query";
import {
  buildIcPpCsvExport,
  buildIcVinculadasPpCsv,
  icPpCsvFilename,
} from "@/lib/pedido-proveedor/ic-pp-csv-export";
import { getPpDetalle, listIcsVinculadasPp } from "@/lib/pedido-proveedor/detail-query";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ ppId: string }> };

/** Exporta todas las IC vinculadas al PP (cualquier categoría). PROGRAMADO incluye detalle PF si hay proforma. */
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

  try {
    let ics = await listIcsVinculadasPp(pool, ppId);
    if (clienteId != null && Number.isFinite(clienteId)) {
      ics = ics.filter((ic) => ic.id_cliente === clienteId);
    }

    let csv: string;

    if (
      header.categoria_id === CATEGORIA_PROGRAMADO_ID &&
      header.total_articulos > 0 &&
      ics.length > 0
    ) {
      const admin = await loadAdministradorIcPp(pool, ppId);
      csv = buildIcPpCsvExport(header, admin, {
        clienteId: Number.isFinite(clienteId) ? clienteId : null,
      });
    } else {
      csv = buildIcVinculadasPpCsv(header, ics);
    }

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
    console.error("[ic-export-csv]", msg, e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
