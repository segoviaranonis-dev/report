import { NextRequest, NextResponse } from "next/server";
import { requireRimecAdmin } from "@/lib/rimec-admin/auth-api";
import { enviarFacturaABazar } from "@/lib/rimec-abastecimiento/traspaso-mutations";
import { getFiRegistroPorNumero, getFiDetallesCanonico } from "@/lib/bazzar-web/compra-web/queries";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Ctx = { params: Promise<{ nro: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { error } = await requireRimecAdmin();
  if (error) return error;

  const { nro } = await ctx.params;
  const decoded = decodeURIComponent(nro);

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false }, { status: 503 });
  }

  try {
    const fi = await getFiRegistroPorNumero(decoded);
    if (!fi) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }
    const detalles = await getFiDetallesCanonico(fi.id);
    return NextResponse.json({ configured: true, fi, detalles });
  } catch (err) {
    console.error("[api/facturacion/[nro]]", err);
    return NextResponse.json({ error: "Error al cargar FI" }, { status: 500 });
  }
}

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { error } = await requireRimecAdmin();
  if (error) return error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const { nro } = await ctx.params;
  const facturaLegacy = decodeURIComponent(nro);

  const result = await enviarFacturaABazar(facturaLegacy);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, message: result.message });
}
