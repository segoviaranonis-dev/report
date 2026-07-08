/**
 * Hotfix operativo: resincroniza FI 8-PV002 desde listado PP #36 (redondeo comercial).
 * Uso único — no commitear credenciales.
 */
import pg from "pg";
import fs from "fs";

const pool = new pg.Pool({
  connectionString: fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim(),
});

const fiId = 25;
const tier = 3;

const client = await pool.connect();
try {
  await client.query("BEGIN");

  const lines = await client.query(
    `
    SELECT
      fid.id,
      fid.ppd_id,
      fid.pares,
      fid.precio_neto::float AS antes,
      ppd.linea,
      ppd.referencia,
      icp.precio_evento_id::int AS evento_id,
      (FLOOR((ROUND((
          COALESCE(pl_fk.fob_ajustado, pl_cod.fob_ajustado) *
          COALESCE(pl_fk.indice_aplicado, pl_cod.indice_aplicado)
        ) / 100) * 100 * 1.12) / 100) * 100) AS lpc03_comercial
    FROM factura_interna_detalle fid
    JOIN factura_interna fi ON fi.id = fid.factura_id
    LEFT JOIN pedido_proveedor pp ON pp.id = fi.pp_id
    LEFT JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
    LEFT JOIN LATERAL (
      SELECT icp.precio_evento_id FROM intencion_compra_pedido icp
      WHERE icp.pedido_proveedor_id = fi.pp_id AND icp.precio_evento_id IS NOT NULL
      ORDER BY icp.id LIMIT 1
    ) icp ON TRUE
    LEFT JOIN material m ON m.proveedor_id = pp.proveedor_importacion_id AND m.codigo_proveedor::text = ppd.material_code
    LEFT JOIN linea l ON l.proveedor_id = pp.proveedor_importacion_id AND l.codigo_proveedor::text = ppd.linea
    LEFT JOIN referencia ref ON ref.codigo_proveedor::text = ppd.referencia AND ref.linea_id = l.id
    LEFT JOIN precio_lista pl_fk ON pl_fk.evento_id = icp.precio_evento_id
      AND pl_fk.linea_id = l.id AND pl_fk.referencia_id = ref.id AND pl_fk.material_id = m.id
    LEFT JOIN LATERAL (
      SELECT pl.fob_ajustado, pl.indice_aplicado FROM precio_lista pl
      WHERE pl.evento_id = icp.precio_evento_id
        AND TRIM(pl.linea_codigo) = TRIM(ppd.linea)
        AND TRIM(pl.referencia_codigo) = TRIM(ppd.referencia)
        AND pl.material_id = m.id
      LIMIT 1
    ) pl_cod ON TRUE
    WHERE fid.factura_id = $1
  `,
    [fiId],
  );

  console.log("ANTES:", lines.rows);

  for (const row of lines.rows) {
    const base = Number(row.lpc03_comercial);
    const subtotal = base * Number(row.pares);
    await client.query(
      `UPDATE factura_interna_detalle SET precio_unit=$2, precio_neto=$2, subtotal=$3 WHERE id=$1`,
      [row.id, base, subtotal],
    );
    if (row.ppd_id && row.evento_id) {
      await client.query(
        `UPDATE pedido_proveedor_detalle SET listado_precio_id=$2, precio_lpc03=$3, precio_vinculado_en=NOW() WHERE id=$1`,
        [row.ppd_id, row.evento_id, base],
      );
    }
    console.log(`OK L${row.linea}/R${row.referencia}: ${row.antes} → ${base}`);
  }

  const tot = await client.query(
    `SELECT SUM(subtotal)::float t, SUM(pares)::int p FROM factura_interna_detalle WHERE factura_id=$1`,
    [fiId],
  );
  await client.query(`UPDATE factura_interna SET total_monto=$2, total_pares=$3 WHERE id=$1`, [
    fiId,
    tot.rows[0].t,
    tot.rows[0].p,
  ]);

  const ped = await client.query(`SELECT pedido_id FROM factura_interna WHERE id=$1`, [fiId]);
  if (ped.rows[0]?.pedido_id) {
    await client.query(
      `UPDATE pedido_venta_rimec SET total_monto=(SELECT SUM(total_monto) FROM factura_interna WHERE pedido_id=$1 AND estado!='ANULADA') WHERE id=$1`,
      [ped.rows[0].pedido_id],
    );
  }

  await client.query("COMMIT");
  console.log("TOTAL FI:", tot.rows[0]);

  const check = await pool.query(
    `SELECT fid.precio_neto, ppd.linea, ppd.referencia FROM factura_interna_detalle fid
     JOIN pedido_proveedor_detalle ppd ON ppd.id=fid.ppd_id WHERE fid.factura_id=$1`,
    [fiId],
  );
  console.log("DESPUES:", check.rows);
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  client.release();
  await pool.end();
}
