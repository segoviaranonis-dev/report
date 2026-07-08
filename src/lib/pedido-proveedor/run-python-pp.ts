import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { getRimecPool } from "@/lib/rimec/pool";
import {
  importProformaCompraPreviaTs,
  importProformaProgramadoTs,
  isProgramadoCategoria,
  previewImportProformaProgramadoTs,
  previewProformaSimpleTs,
  type EmparejamientoShop,
  type FiCreadaProgramado,
  type ProformaImportResult,
  type ProformaPreviewResult,
} from "./proforma-programado-engine";

export type { EmparejamientoShop, FiCreadaProgramado, ProformaImportResult, ProformaPreviewResult };

const execFileAsync = promisify(execFile);

const CONTROL_CENTRAL = path.resolve(process.cwd(), "..", "control_central");
const SCRIPT = path.join(CONTROL_CENTRAL, "scripts", "report_import_proforma_pp.py");

function shouldUseTsEngine(): boolean {
  if (process.env.VERCEL === "1") return true;
  if (process.env.PP_PROFORMA_USE_TS === "1") return true;
  try {
    return !existsSync(SCRIPT);
  } catch {
    return true;
  }
}

async function loadPpCategoria(ppId: number): Promise<number | null> {
  const pool = getRimecPool();
  const { rows } = await pool.query<{ categoria_id: string | number | null }>(
    "SELECT categoria_id FROM pedido_proveedor WHERE id = $1",
    [ppId],
  );
  const raw = rows[0]?.categoria_id;
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

type RunOpts = {
  proforma?: string;
  preview?: boolean;
  borrarImport?: boolean;
  noCrearFi?: boolean;
};

async function runPythonScript(
  ppId: number,
  fileBuffer: Buffer | null,
  originalName: string,
  opts: RunOpts,
): Promise<Record<string, unknown>> {
  if (!process.env.DATABASE_URL) {
    return { ok: false, error: "DATABASE_URL no configurada" };
  }

  const tmpDir = await mkdtemp(path.join(tmpdir(), "pp-proforma-"));
  let tmpFile = "";

  try {
    const args = ["--pp-id", String(ppId)];
    if (opts.borrarImport) args.push("--borrar-import");
    if (opts.preview) args.push("--preview");
    if (opts.noCrearFi) args.push("--no-crear-fi");

    if (fileBuffer) {
      const ext = path.extname(originalName) || ".xls";
      tmpFile = path.join(tmpDir, `proforma${ext}`);
      await writeFile(tmpFile, fileBuffer);
      args.push("--file", tmpFile);
    }

    if (opts.proforma?.trim()) args.push("--proforma", opts.proforma.trim());

    const python = process.env.PYTHON_PATH || "python";
    const { stdout, stderr } = await execFileAsync(python, [SCRIPT, ...args], {
      cwd: CONTROL_CENTRAL,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      maxBuffer: 8 * 1024 * 1024,
      timeout: 300_000,
    });

    const line = stdout.trim().split("\n").filter(Boolean).pop() ?? "";
    try {
      return JSON.parse(line) as Record<string, unknown>;
    } catch {
      return {
        ok: false,
        error: stderr?.trim() || stdout?.trim() || "Salida Python inválida",
      };
    }
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    const tail = err.stdout?.trim().split("\n").filter(Boolean).pop();
    if (tail) {
      try {
        return JSON.parse(tail) as Record<string, unknown>;
      } catch {
        /* fall through */
      }
    }
    return {
      ok: false,
      error: err.stderr?.trim() || err.message || "Error ejecutando script proforma",
    };
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function runProformaPreviewPython(
  ppId: number,
  fileBuffer: Buffer,
  originalName: string,
): Promise<ProformaPreviewResult> {
  if (shouldUseTsEngine()) {
    const categoria = await loadPpCategoria(ppId);
    if (isProgramadoCategoria(categoria)) {
      return previewImportProformaProgramadoTs(ppId, fileBuffer);
    }
    return previewProformaSimpleTs(fileBuffer);
  }

  const raw = await runPythonScript(ppId, fileBuffer, originalName, { preview: true });
  if (raw.ok === false && !raw.emparejamientos && !raw.errores) {
    const categoria = await loadPpCategoria(ppId);
    if (isProgramadoCategoria(categoria)) {
      return previewImportProformaProgramadoTs(ppId, fileBuffer);
    }
    return previewProformaSimpleTs(fileBuffer);
  }
  return raw as ProformaPreviewResult;
}

export async function runProformaImportPython(
  ppId: number,
  fileBuffer: Buffer,
  originalName: string,
  opts: { proforma?: string; borrarImport?: boolean },
): Promise<ProformaImportResult> {
  if (shouldUseTsEngine()) {
    const categoria = await loadPpCategoria(ppId);
    if (isProgramadoCategoria(categoria)) {
      return importProformaProgramadoTs(ppId, fileBuffer, opts.proforma);
    }
    return importProformaCompraPreviaTs(ppId, fileBuffer, opts.proforma);
  }

  const raw = await runPythonScript(ppId, fileBuffer, originalName, {
    proforma: opts.proforma,
    borrarImport: opts.borrarImport,
  });
  if (raw.ok === false && String(raw.error ?? "").includes("script")) {
    const categoria = await loadPpCategoria(ppId);
    if (isProgramadoCategoria(categoria)) {
      return importProformaProgramadoTs(ppId, fileBuffer, opts.proforma);
    }
    return importProformaCompraPreviaTs(ppId, fileBuffer, opts.proforma);
  }
  return raw as ProformaImportResult;
}

export async function runProformaBorrarPython(ppId: number): Promise<ProformaImportResult> {
  const raw = await runPythonScript(ppId, null, "", { borrarImport: true });
  return raw as ProformaImportResult;
}
