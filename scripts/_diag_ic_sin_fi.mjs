import pg from "pg";
import fs from "node:fs";

const ppId = Number(process.argv[2] ?? 28);
const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const pool = new pg.Pool({
  connectionString: env.match(/^DATABASE_URL=(.+)$/m)[1].trim().replace(/^"|"$/g, ""),
});

const ics = await pool.query(
  `SELECT ic.id, ic.numero_registro, ic.id_cliente, ic.cantidad_total_pares
   FROM intencion_compra_pedido icp
   JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
   WHERE icp.pedido_proveedor_id = $1
   ORDER BY ic.id`,
  [ppId],
);

const fis = await pool.query(
  `SELECT fi.id, fi.nro_factura, fi.cliente_id, fi.total_pares
   FROM factura_interna fi WHERE fi.pp_id = $1 ORDER BY fi.id`,
  [ppId],
);

console.log(JSON.stringify({ ppId, n_ic: ics.rowCount, n_fi: fis.rowCount }, null, 2));

if (ics.rowCount !== fis.rowCount) {
  console.log("GAP", ics.rowCount - fis.rowCount, "IC sin FI 1:1 por conteo");
}

await pool.end();
