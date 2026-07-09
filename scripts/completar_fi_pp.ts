/**
 * Crear FI pendientes — PP programado.
 * npx tsx scripts/completar_fi_pp.ts <ppId> [ruta-excel]
 */
import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

import { completarFiProgramadoPhased } from "../src/lib/pedido-proveedor/proforma-programado-engine";

const ppId = Number(process.argv[2]);
const excelPath = process.argv[3];

if (!Number.isFinite(ppId)) {
  console.error("Uso: npx tsx scripts/completar_fi_pp.ts <ppId> [excel.xlsx]");
  process.exit(1);
}

let fileBuffer: Buffer | null = null;
if (excelPath) {
  fileBuffer = fs.readFileSync(path.resolve(excelPath));
  console.log("Excel:", excelPath, fileBuffer.length, "bytes");
}

async function main() {
  let offset = 0;
  let done = false;
  let last: Awaited<ReturnType<typeof completarFiProgramadoPhased>> | null = null;

  while (!done) {
    last = await completarFiProgramadoPhased(ppId, {
      fileBuffer: offset === 0 ? fileBuffer : null,
      fiOffset: offset,
      fiBatchSize: 12,
    });
    console.log(
      JSON.stringify({
        offset,
        ok: last.ok,
        done: last.done,
        n_fi: last.n_fi,
        fi_total: last.fi_total,
        error: last.error,
        message: last.message,
      }),
    );
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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
