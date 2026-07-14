import { NextResponse } from "next/server";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { getStockProntaEntregaResumen } from "@/lib/stock-pronta-entrega/queries-resumen";
import { batchLabelFromFilename, SDRM_FILENAME_REGEX } from "@/lib/deposito-rimec/rimec-csv-sdrm";

const execFileAsync = promisify(execFile);

export async function POST(req: Request) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
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
    const args = [scriptPath, tmpPath];
    if (dryRun) args.push("--dry-run");
    if (replace && !dryRun) args.push("--replace-pe-universe");

    const { stdout, stderr } = await execFileAsync("python", args, {
      cwd: join(process.cwd(), "..", "control_central"),
      maxBuffer: 20 * 1024 * 1024,
      timeout: 600_000,
    });

    const pool = getRimecPool();
    const resumen = dryRun ? null : await getStockProntaEntregaResumen(pool, { batch });

    return NextResponse.json({
      ok: true,
      batch,
      dry_run: dryRun,
      replace_pe_universe: replace && !dryRun,
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
