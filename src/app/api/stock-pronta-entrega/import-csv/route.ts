import { NextResponse } from "next/server";
import { writeFile, unlink, access } from "fs/promises";
import { constants as fsConstants } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { getStockProntaEntregaResumen } from "@/lib/stock-pronta-entrega/queries-resumen";
import {
  isVercelRuntime,
  resolvePythonExecutable,
} from "@/lib/stock-pronta-entrega/resolve-python";
import { batchLabelFromFilename, SDRM_FILENAME_REGEX } from "@/lib/deposito-rimec/rimec-csv-sdrm";

const execFileAsync = promisify(execFile);

export async function POST(req: Request) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  // Vercel no tiene Python ni control_central/scripts — import solo local / CLI.
  if (isVercelRuntime()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Import PE no corre en Vercel (sin Python). Usá http://localhost:3000/stock-pronta-entrega o: python control_central/scripts/import_pe_sdrm_pipeline.py \"csv's/stock's/sdrm####.csv\" --replace-pe-universe",
      },
      { status: 501 },
    );
  }

  let tmpPath: string | null = null;
  try {
    const form = await req.formData();
    const file = form.get("file");
    const replace = form.get("replace_pe_universe") === "1" || form.get("mode") === "replace";
    const dryRun = form.get("dry_run") === "1";

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Archivo CSV requerido" }, { status: 400 });
    }
    if (!SDRM_FILENAME_REGEX.test(file.name)) {
      return NextResponse.json(
        { ok: false, error: "Nombre inválido — usar sdrm####.csv" },
        { status: 400 },
      );
    }

    const batch = batchLabelFromFilename(file.name);
    const buf = Buffer.from(await file.arrayBuffer());
    tmpPath = join(tmpdir(), `pe-import-${Date.now()}-${file.name}`);
    await writeFile(tmpPath, buf);

    const scriptPath = join(process.cwd(), "..", "control_central", "scripts", "import_pe_sdrm_pipeline.py");
    try {
      await access(scriptPath, fsConstants.R_OK);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: `Script no encontrado: ${scriptPath}. Corré el Report desde monorepo Nexus_Core/report.`,
        },
        { status: 500 },
      );
    }

    const python = resolvePythonExecutable();
    const args = [scriptPath, tmpPath];
    if (dryRun) args.push("--dry-run");
    if (replace && !dryRun) args.push("--replace-pe-universe");

    const { stdout, stderr } = await execFileAsync(python, args, {
      cwd: join(process.cwd(), "..", "control_central"),
      maxBuffer: 20 * 1024 * 1024,
      timeout: 600_000,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });

    const pool = getRimecPool();
    const resumen = dryRun ? null : await getStockProntaEntregaResumen(pool, { batch });

    return NextResponse.json({
      ok: true,
      batch,
      dry_run: dryRun,
      replace_pe_universe: replace && !dryRun,
      python,
      stdout: stdout.slice(-8000),
      stderr: stderr.slice(-2000),
      resumen,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error import PE";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  } finally {
    if (tmpPath) {
      try {
        await unlink(tmpPath);
      } catch {
        /* ignore */
      }
    }
  }
}
