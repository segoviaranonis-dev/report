/**
 * Regenerar FI programado: repara brand snapshot + borra FI RESERVADA + recrea 1 IC = 1 FI.
 * npx tsx scripts/regenerar_fi_pp.ts <ppId>
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

import { getRimecPool } from "../src/lib/rimec/pool";
import { enrichProformaBrandsFromPpd } from "../src/lib/pedido-proveedor/proforma-snapshot";
import {
  borrarFiReservadasProgramado,
  completarFiProgramadoPhased,
  diagnoseProgramadoFiPlan,
} from "../src/lib/pedido-proveedor/proforma-programado-engine";

const ppId = Number(process.argv[2]);
if (!Number.isFinite(ppId)) {
  console.error("Uso: npx tsx scripts/regenerar_fi_pp.ts <ppId>");
  process.exit(1);
}

async function main() {
  const pool = getRimecPool();
  const nBrand = await enrichProformaBrandsFromPpd(pool, ppId);
  console.log("Brands reparados en snapshot:", nBrand);

  const pre = await diagnoseProgramadoFiPlan(ppId);
  console.log("Plan previo:", {
    n_ic: pre.n_ic,
    n_jobs: pre.n_jobs,
    ic_sin_fi: pre.ic_sin_fi.length,
    errores: pre.errores.length,
    avisos: pre.avisos.length,
  });
  if (pre.errores.length) {
    console.error("ERRORES plan:", pre.errores.slice(0, 10));
    process.exit(1);
  }
  if (pre.ic_sin_fi.length) {
    console.warn("IC sin job:", pre.ic_sin_fi);
  }

  const del = await borrarFiReservadasProgramado(ppId);
  if (!del.ok) {
    console.error("Borrar FI:", del.error);
    process.exit(1);
  }
  console.log("FI borradas:", del.n);

  let offset = 0;
  let done = false;
  while (!done) {
    const last = await completarFiProgramadoPhased(ppId, { fiOffset: offset, fiBatchSize: 12 });
    console.log(JSON.stringify({ offset, ok: last.ok, done: last.done, n_fi: last.n_fi, fi_total: last.fi_total, error: last.error }));
    if (!last.ok) process.exit(1);
    done = last.done === true;
    if (!done) {
      const next = Number(last.fi_offset_next);
      if (!Number.isFinite(next) || next <= offset) process.exit(1);
      offset = next;
    }
  }

  const post = await diagnoseProgramadoFiPlan(ppId);
  console.log("Plan post:", post);

  const multi = await pool.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM (
       SELECT fi.id FROM factura_interna fi
       JOIN factura_interna_detalle fid ON fid.factura_id = fi.id
       JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
       WHERE fi.pp_id = $1
       GROUP BY fi.id HAVING COUNT(DISTINCT ppd.id_marca) > 1
     ) t`,
    [ppId],
  );
  console.log("FI multi-marca restantes:", multi.rows[0]?.c ?? 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
