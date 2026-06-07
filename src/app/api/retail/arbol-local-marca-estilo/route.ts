import { NextResponse } from "next/server";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import type { RetailArbolSnapshotResponse } from "@/lib/retail/arbol-snapshot-types";
import { construirArbolAlternativo, calcularKpisAlternativo } from "@/lib/retail/build-arbol-alternativo";
import { loadArbolAlternativoLeaves } from "@/lib/retail/load-arbol-alternativo";
import { parseRetailFiltersFromSearchParams } from "@/lib/retail/retail-filters";
import { buildWhereClause } from "@/lib/retail/apply-filters-sql";

const KPI_VACIO = {
  stock: 0,
  venta: 0,
  total: 0,
  skus: 0,
  filasExcel: 0,
};

/**
 * API: Árbol Ente → Marca → Estilo → SKU
 */
export async function GET(request: Request) {
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
    // Parsear filtros de URL
    const { searchParams } = new URL(request.url);
    const filters = parseRetailFiltersFromSearchParams(searchParams);
    const whereClause = buildWhereClause(filters);

    const { leaves, meta, totalFilas } = await loadArbolAlternativoLeaves(whereClause);
    const arbol = construirArbolAlternativo(leaves, "ente-marca-estilo");
    const kpis = calcularKpisAlternativo(leaves, totalFilas);

    const body: RetailArbolSnapshotResponse = {
      configured: true,
      meta,
      kpis,
      arbol,
    };
    return NextResponse.json(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error árbol retail (local-marca-estilo)";
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
