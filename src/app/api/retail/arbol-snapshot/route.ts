import { NextResponse } from "next/server";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import type { RetailArbolSnapshotResponse } from "@/lib/retail/arbol-snapshot-types";
import { calcularKpisArbol, construirArbolRetail } from "@/lib/retail/build-arbol-snapshot";
import { loadRetailArbolLeaves } from "@/lib/retail/load-arbol-leaves";

const KPI_VACIO = {
  stock: 0,
  venta: 0,
  total: 0,
  skus: 0,
  filasExcel: 0,
};

export async function GET() {
  if (!isRimecDatabaseConfigured()) {
    const body: RetailArbolSnapshotResponse = {
      configured: false,
      meta: { archivoOrigen: null, cargadoEn: null },
      kpis: KPI_VACIO,
      arbol: [],
    };
    return NextResponse.json(body);
  }

  try {
    const { leaves, meta, totalFilas } = await loadRetailArbolLeaves();
    const arbol = construirArbolRetail(leaves);
    const kpis = calcularKpisArbol(leaves, totalFilas);

    const body: RetailArbolSnapshotResponse = {
      configured: true,
      meta,
      kpis,
      arbol,
    };
    return NextResponse.json(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error árbol retail";
    return NextResponse.json(
      {
        configured: true,
        meta: { archivoOrigen: null, cargadoEn: null },
        kpis: KPI_VACIO,
        arbol: [],
        error: msg,
      } satisfies RetailArbolSnapshotResponse,
      { status: 500 },
    );
  }
}
