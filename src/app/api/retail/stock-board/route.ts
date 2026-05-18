import { NextRequest, NextResponse } from "next/server";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { buildStockBoardFromStaging, computeRetailKpis, summarizePilares } from "@/lib/retail/build-stock-board";
import { applyRetailFilters, parseRetailFiltersFromSearchParams } from "@/lib/retail/retail-filters";
import { listRetailBatches, loadRetailStagingBatch, resolveRetailBatchId } from "@/lib/retail/query-staging";
import type { RetailPilaresResumen, RetailStockBoardResponse } from "@/lib/retail/types";

const KPI_VACIO = {
  paresEnRed: 0,
  referenciasActivas: 0,
  paresImportadora: 0,
  paresVentaTotal: 0,
  filasStaging: 0,
  filasPilaresOk: 0,
  filasPilaresPendientes: 0,
};

const PILARES_VACIO: RetailPilaresResumen = {
  filasOk: 0,
  filasPendientes: 0,
  mensaje: "Sin lote cargado.",
};

export async function GET(req: NextRequest) {
  if (!isRimecDatabaseConfigured()) {
    const body: RetailStockBoardResponse = {
      configured: false,
      batchId: null,
      batchLabel: null,
      columnas: [],
      kpis: KPI_VACIO,
      pilares: PILARES_VACIO,
    };
    return NextResponse.json(body);
  }

  const batchParam = req.nextUrl.searchParams.get("batch_id");
  const topRaw = Number(req.nextUrl.searchParams.get("top"));
  const top = Number.isFinite(topRaw) && topRaw >= 1 && topRaw <= 48 ? topRaw : 12;

  try {
    const batchId = await resolveRetailBatchId(batchParam);
    if (!batchId) {
      const body: RetailStockBoardResponse = {
        configured: true,
        batchId: null,
        batchLabel: null,
        columnas: [],
        kpis: KPI_VACIO,
        pilares: PILARES_VACIO,
      };
      return NextResponse.json(body);
    }

    const rowsAll = await loadRetailStagingBatch(batchId);
    const filtros = parseRetailFiltersFromSearchParams(req.nextUrl.searchParams);
    const rows = applyRetailFilters(rowsAll, filtros);
    const columnas = buildStockBoardFromStaging(rows, top);
    const kpis = computeRetailKpis(rows);
    const pilares = summarizePilares(rowsAll);
    const batchMeta = (await listRetailBatches(50)).find((b) => b.batchId === batchId);
    const batchLabel = batchMeta?.batchLabel || batchMeta?.archivoOrigen || null;

    const body: RetailStockBoardResponse = {
      configured: true,
      batchId,
      batchLabel,
      columnas,
      kpis,
      pilares,
    };
    return NextResponse.json(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error stock-board retail";
    return NextResponse.json(
      {
        configured: true,
        batchId: null,
        batchLabel: null,
        columnas: [],
        kpis: KPI_VACIO,
        pilares: { ...PILARES_VACIO, mensaje: msg },
        error: msg,
      } satisfies RetailStockBoardResponse,
      { status: 500 },
    );
  }
}
