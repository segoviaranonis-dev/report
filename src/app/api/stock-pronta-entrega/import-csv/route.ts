import { NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { SDRM_FILENAME_REGEX } from "@/lib/deposito-rimec/rimec-csv-sdrm";
import { runPeSdrmPipeline } from "@/lib/stock-pronta-entrega/pe-sdrm-pipeline";
import { invalidarCachePeProductos } from "@/lib/stock-pronta-entrega/queries-productos-cached";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/stock-pronta-entrega/import-csv
 * multipart: file · mode=replace · dry_run=1 opcional
 * Motor Node (Vercel + local) — sin Python.
 */
export async function POST(req: Request) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    const replace =
      form.get("replace_pe_universe") === "1" || form.get("mode") === "replace";
    const dryRun = form.get("dry_run") === "1" || form.get("dry_run") === "true";

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Archivo CSV requerido" }, { status: 400 });
    }
    if (!SDRM_FILENAME_REGEX.test(file.name)) {
      return NextResponse.json(
        { ok: false, error: "Nombre inválido — usar sdrm####.csv" },
        { status: 400 },
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const contentLatin1 = buf.toString("latin1");
    const pool = getRimecPool();
    const result = await runPeSdrmPipeline(pool, {
      filename: file.name,
      contentLatin1,
      replacePeUniverse: replace && !dryRun,
      dryRun,
    });

    if (result.ok && !dryRun) {
      invalidarCachePeProductos();
    }

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error import PE";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
