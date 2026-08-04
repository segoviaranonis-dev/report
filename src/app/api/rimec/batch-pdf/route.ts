import { NextRequest, NextResponse } from "next/server";
import { generateRimecBatchZip } from "@/lib/rimec/pdf-batch";
import type { RimecPdfMeta } from "@/lib/rimec/pdf-gerencial";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

type Body = {
  titlePrefix?: string;
  rows?: Record<string, unknown>[];
  batchCol?: string;
  groupCols?: string[];
  columns?: string[];
  meta?: RimecPdfMeta;
  filename?: string;
  maxFiles?: number;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const batchCol = String(body.batchCol ?? "").trim();
    if (!rows.length) {
      return NextResponse.json({ error: "Sin filas" }, { status: 400 });
    }
    if (!batchCol) {
      return NextResponse.json({ error: "batchCol requerido" }, { status: 400 });
    }
    if (rows.length > 20000) {
      return NextResponse.json({ error: "Demasiadas filas (máx 20000)" }, { status: 400 });
    }

    const { zip, count, skipped } = await generateRimecBatchZip({
      titlePrefix: String(body.titlePrefix ?? "Informe").trim() || "Informe",
      rows,
      batchCol,
      groupCols: body.groupCols,
      columns: body.columns,
      meta: body.meta,
      maxFiles: body.maxFiles ?? 80,
    });

    const filename = (
      body.filename ?? `batch_${batchCol.toLowerCase().replace(/[^\w]+/g, "_")}.zip`
    ).replace(/[^\x20-\x7E]/g, "_");

    return new NextResponse(Buffer.from(zip), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Rimec-Pdf-Count": String(count),
        "X-Rimec-Pdf-Skipped": String(skipped),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error batch PDF";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
