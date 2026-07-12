/**
 * Regenera FI programado (1 IC = 1 FI por shop/marca/cupo) con caso comercial corregido.
 * npx tsx scripts/regenerar_fi_programado_cp.ts [ppId ...]
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

import {
  borrarFiReservadasProgramado,
  completarFiProgramadoPhased,
  PROFORMA_FI_BATCH_SIZE,
} from "../src/lib/pedido-proveedor/proforma-programado-engine";

const DEFAULT = [30, 15, 25, 27, 31, 26, 32];

async function regenerarPp(ppId: number) {
  const del = await borrarFiReservadasProgramado(ppId);
  if (!del.ok) return { ppId, ok: false, error: del.error };

  let offset = 0;
  let last: Awaited<ReturnType<typeof completarFiProgramadoPhased>> | null = null;
  for (;;) {
    last = await completarFiProgramadoPhased(ppId, { fiOffset: offset, fiBatchSize: PROFORMA_FI_BATCH_SIZE });
    if (!last.ok) return { ppId, ok: false, error: last.error, fi_borradas: del.n, partial: last };
    if (last.done) break;
    const next = Number(last.fi_offset_next);
    if (!Number.isFinite(next) || next <= offset) {
      return { ppId, ok: false, error: "offset FI inválido", fi_borradas: del.n };
    }
    offset = next;
  }
  return {
    ppId,
    ok: true,
    fi_borradas: del.n,
    n_fi: last?.n_fi,
    fi_avisos: last?.fi_avisos?.slice(0, 5),
  };
}

async function main() {
  const ids = process.argv.slice(2).map(Number).filter(Number.isFinite);
  const targets = ids.length ? ids : DEFAULT;

  for (const ppId of targets) {
    if (ppId === 28) {
      console.log(JSON.stringify({ ppId, skip: true, reason: "PP-019 referencia" }));
      continue;
    }
    console.log(`\n--- Regenerar PP ${ppId} ---`);
    const r = await regenerarPp(ppId);
    console.log(JSON.stringify(r, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
