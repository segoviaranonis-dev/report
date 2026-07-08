import { execFile } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CONTROL_CENTRAL = path.resolve(process.cwd(), "..", "control_central");
const SCRIPT = path.join(CONTROL_CENTRAL, "scripts", "report_import_proforma_pp.py");

export type EmparejamientoShop = {
  brand: string;
  shop: string;
  pares_proforma: number;
  ic_id: number;
  ic_nro: string;
  id_cliente: number;
  cliente_nombre: string;
  pares_ic: number;
  match: boolean;
};

export type ProformaPreviewResult = {
  ok: boolean;
  preview?: boolean;
  programado?: boolean;
  total_pares?: number;
  n_filas?: number;
  n_grupos_shop?: number;
  emparejamientos?: EmparejamientoShop[];
  errores?: string[];
  listado_vinculado?: boolean;
  evento_id?: number;
  error?: string;
};

export type FiCreadaProgramado = {
  ic_nro: string;
  shop: string;
  fi_nro: string;
  pares: number;
};

export type ProformaImportResult = {
  ok: boolean;
  programado?: boolean;
  pp_id?: number;
  pares?: number;
  n_articulos?: number;
  message?: string;
  n_fi?: number;
  fi_creadas?: FiCreadaProgramado[];
  fi_errores?: string[];
  error?: string;
};

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
  const raw = await runPythonScript(ppId, fileBuffer, originalName, { preview: true });
  return raw as ProformaPreviewResult;
}

export async function runProformaImportPython(
  ppId: number,
  fileBuffer: Buffer,
  originalName: string,
  opts: { proforma?: string; borrarImport?: boolean },
): Promise<ProformaImportResult> {
  const raw = await runPythonScript(ppId, fileBuffer, originalName, {
    proforma: opts.proforma,
    borrarImport: opts.borrarImport,
  });
  return raw as ProformaImportResult;
}

export async function runProformaBorrarPython(ppId: number): Promise<ProformaImportResult> {
  const raw = await runPythonScript(ppId, null, "", { borrarImport: true });
  return raw as ProformaImportResult;
}
