#!/usr/bin/env node
import fs from "fs";
import pg from "pg";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    process.env[k] = v;
  }
}

const { recalcFiLpLogisticaSevero } = await import(
  "../src/lib/pedido-proveedor/recalc-fi-lp-logistica.ts"
);

const url = process.env.DATABASE_URL;
const ppId = Number(process.argv[2] || 38);
const lp = Number(process.argv[3] || 3);
const limit = process.argv[4] ? Number(process.argv[4]) : null;

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

let q = `SELECT id FROM factura_interna WHERE pp_id=$1 AND estado IN ('RESERVADA','CONFIRMADA') ORDER BY nro_factura`;
if (limit) q += ` LIMIT ${limit}`;
const { rows } = await pool.query(q, [ppId]);
const fiIds = rows.map((r) => Number(r.id));

console.log(`PP ${ppId} · LP ${lp} · ${fiIds.length} FI`);
const result = await recalcFiLpLogisticaSevero(pool, ppId, {
  fiIds,
  listaPrecioId: lp,
  modoImpositor: true,
});
console.log(JSON.stringify(result, null, 2));
await pool.end();
