import pg from "pg";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const m = env.match(/^DATABASE_URL=(.+)$/m);
const pool = new pg.Pool({ connectionString: m[1].trim() });

const evs = await pool.query(`
  SELECT id, nombre_evento, (SELECT COUNT(*) FROM precio_lista pl WHERE pl.evento_id=pe.id) n
  FROM precio_evento pe ORDER BY id DESC LIMIT 8
`);
console.log("eventos:", evs.rows);

const ppId = 14;
const antes = await pool.query(`
  SELECT
    (SELECT SUM(total_monto)::numeric FROM factura_interna WHERE pp_id=$1) fi_monto,
    (SELECT STRING_AGG(DISTINCT lista_precio_id::text, ',') FROM factura_interna WHERE pp_id=$1) fi_lp,
    (SELECT precio_evento_id FROM intencion_compra_pedido WHERE pedido_proveedor_id=$1 LIMIT 1) icp_ev,
    (SELECT COUNT(*) FROM pedido_proveedor_detalle WHERE pedido_proveedor_id=$1 AND GREATEST(0,cantidad_pares-COALESCE(pares_vendidos,0))>0) saldo_rows,
    (SELECT COUNT(*) FROM pedido_proveedor_detalle WHERE pedido_proveedor_id=$1 AND COALESCE(pares_vendidos,0)>0 AND GREATEST(0,cantidad_pares-COALESCE(pares_vendidos,0))=0) congeladas
`, [ppId]);
console.log("PP14 antes:", antes.rows[0]);

const altEv = evs.rows.find((e) => String(e.id) !== String(antes.rows[0].fi_lp?.split(',')[0] || antes.rows[0].icp_ev));
console.log("alt evento:", altEv?.id, altEv?.nombre_evento);

if (altEv) {
  const snap = await pool.query(`SELECT vincular_listado_a_pp($1, $2, NULL) r`, [ppId, altEv.id]);
  console.log("vincular RPC:", snap.rows[0].r);
}

const despues = await pool.query(`
  SELECT
    (SELECT SUM(total_monto)::numeric FROM factura_interna WHERE pp_id=$1) fi_monto,
    (SELECT STRING_AGG(DISTINCT lista_precio_id::text, ',') FROM factura_interna WHERE pp_id=$1) fi_lp,
    (SELECT precio_evento_id FROM intencion_compra_pedido WHERE pedido_proveedor_id=$1 LIMIT 1) icp_ev,
    (SELECT SUM(COALESCE(precio_lpn,0))::bigint FROM pedido_proveedor_detalle WHERE pedido_proveedor_id=$1 AND GREATEST(0,cantidad_pares-COALESCE(pares_vendidos,0))>0) sum_lpn_saldo
`, [ppId]);
console.log("PP14 despues vincular (sin recalc python):", despues.rows[0]);

await pool.end();
