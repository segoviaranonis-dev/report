import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CONTROL_CENTRAL = path.resolve(process.cwd(), "..", "control_central");
const SCRIPT = path.join(CONTROL_CENTRAL, "generar_pdf_cli.py");

export type FiPdfResult =
  | { ok: true; buffer: Buffer; filename: string }
  | { ok: false; error: string };

export async function runFiPdfPython(
  fiId: number,
  filenameHint?: string,
): Promise<FiPdfResult> {
  if (!process.env.DATABASE_URL) {
    return { ok: false, error: "DATABASE_URL no configurada" };
  }

  try {
    const python = process.env.PYTHON_PATH || "python";
    const { stdout } = await execFileAsync(python, [SCRIPT, String(fiId)], {
      cwd: CONTROL_CENTRAL,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      maxBuffer: 16 * 1024 * 1024,
      timeout: 240_000,
      encoding: "buffer",
    });

    const buffer = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
    if (!buffer.length) {
      return { ok: false, error: "PDF vacío" };
    }

    const safe = (filenameHint || `FI_${fiId}`).replace(/[^\w.-]+/g, "_");
    return { ok: true, buffer, filename: `${safe}.pdf` };
  } catch (e) {
    const err = e as { stderr?: Buffer | string; message?: string };
    const stderr =
      typeof err.stderr === "string"
        ? err.stderr
        : err.stderr
          ? err.stderr.toString("utf-8")
          : "";
    return {
      ok: false,
      error: stderr.trim() || err.message || "Error generando PDF",
    };
  }
}
