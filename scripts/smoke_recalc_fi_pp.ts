/** Smoke recalc FI PP — npx tsx scripts/smoke_recalc_fi_pp.ts [ppId] */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { recalcularFisPp } from "../src/lib/pedido-proveedor/recalcular-fis-pp";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  for (const line of readFileSync(resolve(__dirname, "../.env.local"), "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
} catch {
  /* optional */
}

async function main() {
  const ppId = Number(process.argv[2] || 14);
  const r = await recalcularFisPp(ppId, { incluirConfirmadas: true });
  console.log(JSON.stringify(r, null, 2));
  if (!r.ok) process.exit(1);

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query(
    `SELECT fi.nro_factura, fid.precio_unit, fid.precio_neto, fid.subtotal, fi.total_monto
     FROM factura_interna fi
     JOIN factura_interna_detalle fid ON fid.factura_id = fi.id
     WHERE fi.pp_id = $1 AND fi.nro_factura ILIKE '%PV022%'`,
    [ppId],
  );
  console.log("PV022 after:", rows[0]);
  await pool.end();
}

void main();
