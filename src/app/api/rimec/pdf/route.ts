import { NextRequest, NextResponse } from "next/server";
import { generateRimecGerencialPdf, type RimecPdfMeta } from "@/lib/rimec/pdf-gerencial";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

type Body = {
  title?: string;
  rows?: Record<string, unknown>[];
  groupCols?: string[];
  columns?: string[];
  meta?: RimecPdfMeta;
  showTotal?: boolean;
  mode?: "gerencial" | "listado";
  filename?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const title = String(body.title ?? "Informe").trim() || "Informe";
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) {
      return NextResponse.json({ error: "Sin filas" }, { status: 400 });
    }
    if (rows.length > 8000) {
      return NextResponse.json({ error: "Demasiadas filas (máx 8000)" }, { status: 400 });
    }

    const bytes = await generateRimecGerencialPdf({
      title,
      rows,
      groupCols: body.groupCols,
      columns: body.columns,
      meta: body.meta,
      showTotal: body.showTotal,
      mode: body.mode ?? "gerencial",
    });

    const filename = (body.filename ?? `${title.replace(/[^\w\-]+/g, "_").slice(0, 60)}.pdf`).replace(
      /[^\x20-\x7E]/g,
      "_",
    );

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error PDF";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
