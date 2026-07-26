/**
 * Prueba imposición listado motor · sin match → precio 0.
 * Uso: npx tsx scripts/_test_listado_motor_cero_pp38.mts [ppId] [fiId] [eventoId]
 */
import fs from "fs";
import pg from "pg";
import { actualizarListadoMotorFiDesdePp } from "../src/lib/pedido-proveedor/fi-pp-actions";

const ppId = Number(process.argv[2] ?? 38);
const fiId = Number(process.argv[3] ?? 3423);
const eventoId = Number(process.argv[4] ?? 27);

const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("DATABASE_URL no encontrada en .env.local");
  process.exit(1);
}

process.env.DATABASE_URL = url;

const pool = new pg.Pool({ connectionString: url });

async function snapshot(label: string) {
  const fi = await pool.query(
    `SELECT nro_factura, total_monto, lista_precio_id FROM factura_interna WHERE id = $1`,
    [fiId],
  );
  const ic = await pool.query(
    `SELECT ic.precio_evento_id FROM intencion_compra ic
     JOIN intencion_compra_pedido icp ON icp.intencion_compra_id = ic.id
     JOIN factura_interna fi ON fi.pp_id = icp.pedido_proveedor_id AND fi.cliente_id = ic.id_cliente
     WHERE fi.id = $1 LIMIT 1`,
    [fiId],
  );
  const det = await pool.query(
    `SELECT COUNT(*)::int AS n,
            COUNT(*) FILTER (WHERE precio_neto = 0)::int AS cero,
            COUNT(*) FILTER (WHERE precio_neto > 0)::int AS con_precio
     FROM factura_interna_detalle WHERE factura_id = $1`,
    [fiId],
  );
  console.log(`\n=== ${label} ===`);
  console.log("FI:", fi.rows[0]);
  console.log("IC evento:", ic.rows[0]?.precio_evento_id ?? null);
  console.log("Detalle:", det.rows[0]);
}

console.log(`\n>>> TEST listado motor cero · PP-${ppId} FI-${fiId} evento #${eventoId}`);

await snapshot("ANTES");
const t0 = Date.now();
const result = await actualizarListadoMotorFiDesdePp(pool, ppId, fiId, eventoId);
const ms = Date.now() - t0;

console.log(`\n=== RESULTADO (${ms}ms) ===`);
console.log("ok:", result.ok);
if (!result.ok) {
  console.log("error:", result.error);
} else if (result.report) {
  const r = result.report;
  console.log({
    evento: r.evento_id,
    evento_antes: r.evento_id_antes,
    monto_antes: r.monto_antes,
    monto_despues: r.monto_despues,
    delta: r.delta_monto,
    skus_total: r.skus_total,
    skus_ok: r.skus_ok,
    skus_sin_match: r.skus_sin_match,
    skus_cambiados: r.skus_cambiados,
    logistica: r.logistica_sync,
  });
  if (r.sin_match.length) {
    console.log("sin_match (muestra 5):", r.sin_match.slice(0, 5).join(" · "));
  }
}

await snapshot("DESPUÉS");
await pool.end();
