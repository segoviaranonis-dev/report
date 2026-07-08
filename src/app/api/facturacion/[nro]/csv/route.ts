import { NextRequest, NextResponse } from "next/server";
import { requireRimecAdmin } from "@/lib/rimec-admin/auth-api";
import { exportCsvVentasFi } from "@/lib/facturacion/csv-fi-export";
import { isPeFi } from "@/lib/facturacion/csv-pe-ventas-export";
import { getFiRegistroPorNumero } from "@/lib/bazzar-web/compra-web/queries";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Ctx = { params: Promise<{ nro: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { error } = await requireRimecAdmin();
  if (error) return error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const { nro } = await ctx.params;
  const decoded = decodeURIComponent(nro);

  try {
    const fi = await getFiRegistroPorNumero(decoded);
    if (!fi) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }
    const pe = isPeFi({ nro_factura: fi.nro_factura, pp_id: fi.pp_id ?? null });
    if (pe && fi.estado !== "CONFIRMADA") {
      return NextResponse.json(
        { error: "CSV veneno PE requiere FI CONFIRMADA" },
        { status: 400 },
      );
    }
    if (!pe && fi.estado !== "CONFIRMADA" && fi.estado !== "RESERVADA") {
      return NextResponse.json({ error: "FI no exportable en este estado" }, { status: 400 });
    }

    const pool = getRimecPool();
    const { content, filename, rowCount } = await exportCsvVentasFi(pool, fi.id, {
      pv_global: fi.pv_global,
      nro_factura: fi.nro_factura,
      proforma: null,
      pedido: fi.nro_pp ?? undefined,
      pp_id: fi.pp_id,
      pedido_id: fi.pedido_id,
      cliente_id: fi.cliente_id,
    });

    if (rowCount === 0) {
      return NextResponse.json({ error: "Sin líneas para CSV" }, { status: 400 });
    }

    return new NextResponse(Buffer.from(content, "utf-8"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[api/facturacion/[nro]/csv]", err);
    const msg = err instanceof Error ? err.message : "Error generando CSV";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
