/**
 * Resuelve ejecutable Python en Windows/local (evita spawn ENOENT).
 * En Vercel no hay Python — el caller debe cortar antes.
 */
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const CANDIDATES = [
  process.env.PYTHON_PATH,
  "python",
  "py",
  "python3",
  "C:\\Users\\hecto\\AppData\\Local\\Python\\pythoncore-3.14-64\\python.exe",
].filter(Boolean) as string[];

export function resolvePythonExecutable(): string {
  for (const bin of CANDIDATES) {
    try {
      if (bin.includes("\\") || bin.includes("/")) {
        if (!existsSync(bin)) continue;
        execFileSync(bin, ["--version"], { stdio: "ignore", timeout: 5000 });
        return bin;
      }
      execFileSync(bin, ["--version"], { stdio: "ignore", timeout: 5000 });
      return bin;
    } catch {
      /* siguiente */
    }
  }
  throw new Error(
    "Python no encontrado (spawn ENOENT). Definí PYTHON_PATH en report/.env.local o instalá Python en PATH.",
  );
}

export function isVercelRuntime(): boolean {
  return process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
}
