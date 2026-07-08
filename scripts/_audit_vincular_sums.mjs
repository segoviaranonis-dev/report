import pg
import fs from "fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);
const env = fs.readFileSync("report/.env.local", "utf8");
const m = env.match(/^DATABASE_URL=(.+)$/m);
const pool = new pg.Pool({ connectionString: m[1].trim() });

async function sums(ppId) {
  const ppd = await pool.query(
    `SELECT COUNT(*)::int n,
            SUM(cantidad_pares)::bigint ini,
            SUM(pares_vendidos)::bigint ven,
            SUM(COALESCE(precio_lpn,0))::bigint sum_lpn,
            COUNT(*) FILTER (WHERE listado_precio_id IS NOT NULL)::int con_listado,
            COUNT(*) FILTER (WHERE GREATEST(0,cantidad_pares-COALESCE(pares_vendidos,0))=0 AND pares_vendidos>0)::int congeladas
     FROM pedido_proveedor_detalle WHERE pedido_proveedor_id=$1`,
    [ppId],
  );
  const fi = await pool.query(
    `SELECT fi.estado, COUNT(*)::int n,
            SUM(fi.total_pares)::bigint pares,
            SUM(fi.total_monto)::numeric(18,2) monto,
            SUM(fi.lista_precio_id)::bigint sum_lp_id,
            STRING_AGG(DISTINCT fi.lista_precio_id::text, ',') lp_ids
     FROM factura_interna fi WHERE fi.pp_id=$1
     GROUP BY fi.estado ORDER BY fi.estado`,
    [ppId],
  );
  const icp = await pool.query(
    `SELECT precio_evento_id FROM intencion_compra_pedido WHERE pedido_proveedor_id=$1 LIMIT 1`,
    [ppId],
  );
  return { ppd: ppd.rows[0], fi: fi.rows, evento_icp: icp.rows[0]?.precio_evento_id };
}

const ppId = Number(process.argv[2] || 15);
const eventoNuevo = Number(process.argv[3] || 0);

console.log("=== ANTES pp", ppId, "===");
const antes = await sums(ppId);
console.log(JSON.stringify(antes, null, 2));

if (eventoNuevo > 0) {
  const script = path.resolve("control_central/scripts/report_vincular_listado_pp.py");
  const { stdout } = await execFileAsync("python", [
    script,
    "--pp-id",
    String(ppId),
    "--evento-id",
    String(eventoNuevo),
    "--incluir-confirmadas",
  ], { cwd: path.resolve("control_central"), env: process.env, maxBuffer: 4 * 1024 * 1024 });
  console.log("PYTHON:", stdout.trim().split("\n").pop());
}

console.log("=== DESPUÉS ===");
const despues = await sums(ppId);
console.log(JSON.stringify(despues, null, 2));

await pool.end();
