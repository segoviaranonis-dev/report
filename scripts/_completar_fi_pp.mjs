/**
 * Crear FI pendientes para un PP programado (lotes).
 * Uso: node scripts/_completar_fi_pp.mjs <ppId> [ruta-excel-proforma]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reportRoot = path.resolve(__dirname, "..");

// Cargar .env.local
const envPath = path.join(reportRoot, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const ppId = Number(process.argv[2]);
const excelPath = process.argv[3];

if (!Number.isFinite(ppId)) {
  console.error("Uso: node scripts/_completar_fi_pp.mjs <ppId> [excel.xlsx]");
  process.exit(1);
}

// Import dinámico TS compilado vía tsx si existe, sino registrar ts-node path
let completarFiProgramadoPhased;
try {
  const mod = await import("../src/lib/pedido-proveedor/proforma-programado-engine.ts");
  completarFiProgramadoPhased = mod.completarFiProgramadoPhased;
} catch {
  // tsx fallback
  const { register } = await import("tsx/esm/api").catch(() => ({ register: null }));
  if (register) register();
  const mod = await import("../src/lib/pedido-proveedor/proforma-programado-engine.ts");
  completarFiProgramadoPhased = mod.completarFiProgramadoPhased;
}

let fileBuffer = null;
if (excelPath) {
  fileBuffer = fs.readFileSync(path.resolve(excelPath));
  console.log("Excel:", excelPath, fileBuffer.length, "bytes");
}

let offset = 0;
let done = false;
let last = null;
while (!done) {
  last = await completarFiProgramadoPhased(ppId, {
    fileBuffer: offset === 0 ? fileBuffer : null,
    fiOffset: offset,
    fiBatchSize: 12,
  });
  console.log(JSON.stringify({ offset, ok: last.ok, done: last.done, n_fi: last.n_fi, fi_total: last.fi_total, message: last.message, error: last.error }));
  if (!last.ok) process.exit(1);
  done = last.done === true;
  if (!done) {
    const next = Number(last.fi_offset_next);
    if (!Number.isFinite(next) || next <= offset) {
      console.error("Loop detenido", last);
      process.exit(1);
    }
    offset = next;
    fileBuffer = null;
  }
}
console.log("COMPLETO", last);
