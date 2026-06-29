import { NextRequest, NextResponse } from "next/server";
import { assertSinStagingPendiente } from "@/lib/caja-bazzar/staging-guard";
import {
  entePermitidoParaArchivo,
  importBazzarCsvBatch,
  type ImportCsvMode,
} from "@/lib/depositos/bazzar-csv-import";
import {
  entesPermitidosImport,
  puedeImportarCsvGlobal,
} from "@/lib/depositos/depositos-acceso";
import { getDepositoAccesoFromSession } from "@/lib/depositos/depositos-session";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/depositos/import-csv
 * multipart/form-data:
 *   files — 1..3 CSV (sdfm####.csv · sdsm####.csv · sdpl####.csv)
 *   mode — replace | merge
 *   dry_run — 1 opcional
 *
 * replace = DELETE total por tabla afectada + INSERT (desconectado de Retail)
 * merge   = suma cantidad sobre filas existentes (misma molécula + grada)
 */
export async function POST(req: NextRequest) {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ success: false, error: "Base de datos no configurada" }, { status: 500 });
  }

  const acceso = await getDepositoAccesoFromSession();
  if (!acceso) {
    return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  }

  const form = await req.formData();
  const modeRaw = String(form.get("mode") ?? "replace");
  const mode: ImportCsvMode = modeRaw === "merge" ? "merge" : "replace";
  const dryRun = form.get("dry_run") === "1" || form.get("dry_run") === "true";

  const fileEntries = form.getAll("files");
  const files: { filename: string; content: string }[] = [];

  for (const entry of fileEntries) {
    if (!(entry instanceof File)) continue;
    const buf = Buffer.from(await entry.arrayBuffer());
    files.push({
      filename: entry.name,
      content: buf.toString("latin1"),
    });
  }

  if (!files.length) {
    return NextResponse.json(
      { success: false, error: "Subí al menos un CSV (sdfm · sdsm · sdpl + lote)" },
      { status: 400 },
    );
  }

  if (files.length > 3) {
    return NextResponse.json(
      { success: false, error: "Máximo 3 archivos por lote (uno por ente)" },
      { status: 400 },
    );
  }

  const entesOk = entesPermitidosImport(acceso);
  for (const f of files) {
    const check = entePermitidoParaArchivo(f.filename, entesOk);
    if (!check.ok) {
      return NextResponse.json({ success: false, error: check.reason }, { status: 403 });
    }
  }

  const bloqueo = await assertSinStagingPendiente();
  if (bloqueo) {
    return NextResponse.json({ success: false, error: bloqueo }, { status: 409 });
  }

  if (mode === "replace" && !dryRun) {
    const confirm = form.get("confirm_replace");
    if (confirm !== "1" && confirm !== "true") {
      return NextResponse.json(
        {
          success: false,
          error: "Reemplazo total requiere confirm_replace=1",
          requires_confirm: true,
        },
        { status: 400 },
      );
    }
  }

  try {
    const pool = getRimecPool();
    const result = await importBazzarCsvBatch(pool, files, mode, dryRun);

    return NextResponse.json({
      ...result,
      puede_import_global: puedeImportarCsvGlobal(acceso),
      origen: "BAZZAR_CSV",
      retail_desconectado: true,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
