import { NextRequest, NextResponse } from "next/server";
import { requireRimecAdmin } from "@/lib/rimec-admin/auth-api";
import { getCompraDetalleCompleto } from "@/lib/compra-legal/queries";
import { getFiDetallesCanonico } from "@/lib/bazzar-web/compra-web/queries";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { error } = await requireRimecAdmin();
  if (error) return error;

  const { id } = await ctx.params;
  const idCl = parseInt(id, 10);
  if (!Number.isFinite(idCl)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false }, { status: 503 });
  }

  try {
    const detalle = await getCompraDetalleCompleto(idCl);
    if (!detalle.header) {
      return NextResponse.json({ error: "Compra legal no encontrada" }, { status: 404 });
    }

    const fiDetalles: Record<number, Awaited<ReturnType<typeof getFiDetallesCanonico>>> = {};
    for (const fi of detalle.facturas) {
      fiDetalles[fi.id] = await getFiDetallesCanonico(fi.id);
    }

    return NextResponse.json({ configured: true, ...detalle, fiDetalles });
  } catch (err) {
    console.error("[api/compra-legal/[id]]", err);
    return NextResponse.json({ error: "Error al cargar detalle CL" }, { status: 500 });
  }
}
