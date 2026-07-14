/** Diagnóstico PP14 · FI 14-PV022 · 7227-102 — ¿debió actualizar precio? */
import pg from "pg";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const m = env.match(/^DATABASE_URL=(.+)$/m);
if (!m) throw new Error("DATABASE_URL missing");
const pool = new pg.Pool({ connectionString: m[1].trim() });

const ppId = 14;

const pp = await pool.query(
  `SELECT id, numero_registro, estado, categoria_id FROM pedido_proveedor WHERE id = $1`,
  [ppId],
);
console.log("\n=== PP ===", pp.rows[0]);

const icp = await pool.query(
  `SELECT precio_evento_id, pedido_proveedor_id
   FROM intencion_compra_pedido WHERE pedido_proveedor_id = $1`,
  [ppId],
);
console.log("\n=== ICP precio_evento_id ===", icp.rows);

const ev = await pool.query(
  `SELECT pe.id, pe.nombre_evento, pe.estado,
          (SELECT COUNT(*)::int FROM precio_lista pl WHERE pl.evento_id = pe.id) AS n_precios
   FROM precio_evento pe
   WHERE pe.id IN (34, 49)
      OR pe.nombre_evento ILIKE '%8894%'
   ORDER BY pe.id`,
);
console.log("\n=== Eventos 34/49/8894 ===");
for (const r of ev.rows) console.log(r);

const fi = await pool.query(
  `SELECT fi.id, fi.nro_factura, fi.estado, fi.lista_precio_id, fi.total_monto,
          fi.cliente_id,           fi.descuento_1, fi.descuento_2, fi.descuento_3, fi.descuento_4,
          fi.created_at
   FROM factura_interna fi
   WHERE fi.pp_id = $1 AND fi.nro_factura ILIKE '%PV022%'`,
  [ppId],
);
console.log("\n=== FI PV022 ===", fi.rows[0] ?? "NO ENCONTRADA");
const fiId = fi.rows[0]?.id;

if (fiId) {
  const det = await pool.query(
    `SELECT fid.id, fid.precio_unit, fid.precio_neto, fid.subtotal, fid.pares, fid.cajas,
            fid.ppd_id, fid.linea_snapshot,
            ppd.linea, ppd.referencia, ppd.material_code, ppd.color_code,
            ppd.precio_lpn, ppd.precio_lpc02, ppd.precio_lpc03, ppd.precio_lpc04,
            ppd.listado_precio_id, ppd.cantidad_pares, ppd.pares_vendidos,
            GREATEST(0, ppd.cantidad_pares - COALESCE(ppd.pares_vendidos, 0)) AS saldo
     FROM factura_interna_detalle fid
     LEFT JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
     WHERE fid.factura_id = $1`,
    [fiId],
  );
  console.log("\n=== FI detalle + PPD snapshot ===");
  for (const r of det.rows) console.log(JSON.stringify(r, null, 2));

  const icEv = icp.rows[0]?.precio_evento_id;
  if (icEv && det.rows[0]) {
    const d = det.rows[0];
    const pl = await pool.query(
      `SELECT lpn, lpc02, lpc03, lpc04, linea_id, referencia_id, material_id
       FROM precio_lista pl
       WHERE pl.evento_id = $1
         AND pl.linea_id = (SELECT id FROM linea WHERE codigo_proveedor = $2 LIMIT 1)
         AND pl.referencia_id = (SELECT id FROM referencia WHERE codigo_proveedor = $3 LIMIT 1)
       LIMIT 5`,
      [icEv, String(d.linea ?? ""), String(d.referencia ?? "")],
    );
    console.log(`\n=== precio_lista evento ${icEv} para ${d.linea}-${d.referencia} ===`, pl.rows);

    for (const evId of [34, 49]) {
      const pl2 = await pool.query(
        `SELECT pl.lpn, pl.lpc02, pl.lpc03, pl.lpc04
         FROM precio_lista pl
         JOIN linea l ON l.id = pl.linea_id
         JOIN referencia r ON r.id = pl.referencia_id
         WHERE pl.evento_id = $1 AND l.codigo_proveedor = $2 AND r.codigo_proveedor = $3
         LIMIT 3`,
        [evId, String(d.linea ?? ""), String(d.referencia ?? "")],
      );
      console.log(`precio_lista evento #${evId}:`, pl2.rows);
    }
  }
}

const fiAll = await pool.query(
  `SELECT nro_factura, estado, lista_precio_id, total_monto::numeric
   FROM factura_interna WHERE pp_id = $1 ORDER BY nro_factura`,
  [ppId],
);
console.log("\n=== Todas FI PP14 ===");
for (const r of fiAll.rows) console.log(r);

const ppd7227 = await pool.query(
  `SELECT id, linea, referencia, precio_lpn, precio_lpc03, listado_precio_id,
          cantidad_pares, pares_vendidos,
          GREATEST(0, cantidad_pares - COALESCE(pares_vendidos, 0)) AS saldo
   FROM pedido_proveedor_detalle
   WHERE pedido_proveedor_id = $1 AND linea = '7227' AND referencia = '102'`,
  [ppId],
);
console.log("\n=== PPD 7227-102 ===", ppd7227.rows);

await pool.end();
