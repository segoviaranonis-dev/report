/** Smoke: generación PDF FI vía Node (sin Python). Uso: npx tsx scripts/smoke_fi_pdf.ts [fiId] */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runFiPdf } from "../src/lib/pedido-proveedor/run-fi-pdf";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");
try {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
} catch {
  /* .env.local opcional */
}

async function main() {
  const fiId = Number(process.argv[2] || 80);
  const r = await runFiPdf(fiId, "smoke");
  if (r.ok) {
    console.log(`OK fi=${fiId} bytes=${r.buffer.length} file=${r.filename}`);
    process.exit(0);
  }
  console.error(`FAIL fi=${fiId}: ${r.error}`);
  process.exit(1);
}

void main();
