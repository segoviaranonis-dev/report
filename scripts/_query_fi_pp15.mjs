import fs from "node:fs";
import pg from "pg";

const env = fs.readFileSync("c:/Users/hecto/Nexus_Core/report/.env.local", "utf8");
const db = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim().replace(/^"|"$/g, "");
const client = new pg.Client({ connectionString: db });
await client.connect();

const fi = await client.query(`
  SELECT fi.id, fi.nro_factura, fi.pv_global, pp.id as pp_id,
         fi.descuento_1, fi.descuento_2, fi.descuento_3, fi.descuento_4
  FROM factura_interna fi
  JOIN pedido_proveedor pp ON pp.id = fi.pp_id
  WHERE pp.numero_registro = 'PP-2026-0015'
  ORDER BY fi.id LIMIT 3
`);
console.log("FIs:", JSON.stringify(fi.rows, null, 2));

const fiId = fi.rows[0]?.id;
if (fiId) {
  const cnt = await client.query(
    `SELECT COUNT(*)::int AS n FROM factura_interna_detalle WHERE factura_id = $1`,
    [fiId],
  );
  console.log("items FI", fiId, cnt.rows[0].n);
  const det = await client.query(`
    SELECT fid.precio_unit, fid.precio_neto, fid.linea_snapshot, ppd.grades_json
    FROM factura_interna_detalle fid
    LEFT JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
    WHERE fid.factura_id = $1 LIMIT 2
  `, [fiId]);
  console.log("Detalle:", JSON.stringify(det.rows, null, 2));
}

await client.end();
