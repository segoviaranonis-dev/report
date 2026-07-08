import pg from "pg";
import fs from "fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);
const env = fs.readFileSync(".env.local", "utf8");
const m = env.match(/^DATABASE_URL=(.+)$/m);
const pool = new pg.Pool({ connectionString: m[1].trim() });

async function snapshot(ppId) {
  const r = await pool.query(
    `SELECT
      (SELECT precio_evento_id::text FROM intencion_compra_pedido WHERE pedido_proveedor_id=$1 LIMIT 1) icp_ev,
      (SELECT SUM(total_monto)::numeric FROM factura_interna WHERE pp_id=$1) fi_monto,
      (SELECT SUM(subtotal)::numeric FROM factura_interna_detalle fid
         JOIN factura_interna fi ON fi.id=fid.factura_id WHERE fi.pp_id=$1) det_sub,
      (SELECT COUNT(*)::int FROM pedido_proveedor_detalle WHERE pedido_proveedor_id=$1
         AND listado_precio_id IS NOT NULL) ppd_con_listado,
      (SELECT SUM(COALESCE(precio_lpn,0))::bigint FROM pedido_proveedor_detalle WHERE pedido_proveedor_id=$1
         AND GREATEST(0,cantidad_pares-COALESCE(pares_vendidos,0))>0) lpn_saldo`,
    [ppId],
  );
  return r.rows[0];
}

const ppId = 14;
const eventoNuevo = 35; // user screenshot event

console.log("ANTES", await snapshot(ppId));

const script = path.resolve("../control_central/scripts/report_vincular_listado_pp.py");
const { stdout } = await execFileAsync(
  "python",
  [script, "--pp-id", String(ppId), "--evento-id", String(eventoNuevo), "--incluir-confirmadas"],
  { cwd: path.resolve("../control_central"), env: process.env, maxBuffer: 8 * 1024 * 1024, timeout: 180000 },
);
console.log("PYTHON", stdout.trim().split("\n").pop());

console.log("DESPUES", await snapshot(ppId));

const cmp = await pool.query(
  `SELECT fi.id, fi.lista_precio_id, fi.total_monto::numeric monto_antes
   FROM factura_interna fi WHERE fi.pp_id=$1`,
  [ppId],
);
console.log("FI headers:", cmp.rows);

await pool.end();
