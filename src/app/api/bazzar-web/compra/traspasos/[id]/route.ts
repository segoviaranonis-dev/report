import { NextRequest, NextResponse } from "next/server";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import {
  getFacturaLineas,
  getFiDetallesCanonico,
  getFiRegistroPorNumero,
  getTraspasoDetail,
  getTraspasoDetalleLines,
} from "@/lib/bazzar-web/compra-web/queries";

type Params = { params: Promise<{ id: string }> };

/** GET /api/bazzar-web/compra/traspasos/[id] — detalle completo */
export async function GET(_req: NextRequest, { params }: Params) {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false }, { status: 503 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const detail = await getTraspasoDetail(id);
    if (!detail) {
      return NextResponse.json({ error: "Traspaso no encontrado" }, { status: 404 });
    }

    const lineas = await getTraspasoDetalleLines(id);
    const docRef = detail.factura !== "—" ? detail.factura : "";

    let fi = null;
    let fiDetalles: Awaited<ReturnType<typeof getFiDetallesCanonico>> = [];
    let legacyLineas: Awaited<ReturnType<typeof getFacturaLineas>> = [];

    if (docRef) {
      fi = await getFiRegistroPorNumero(docRef);
      if (fi) {
        fiDetalles = await getFiDetallesCanonico(fi.id);
      } else {
        legacyLineas = await getFacturaLineas(docRef);
      }
    }

    return NextResponse.json({
      configured: true,
      detail,
      lineas,
      fi,
      fiDetalles,
      legacyLineas,
    });
  } catch (err) {
    console.error("[bazzar-web/compra/traspasos/[id]]", err);
    return NextResponse.json({ error: "Error al cargar detalle" }, { status: 500 });
  }
}
