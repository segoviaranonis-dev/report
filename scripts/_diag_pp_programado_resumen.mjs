import fs from "fs";
import pg from "pg";

const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const c = new pg.Client({ connectionString: url });
await c.connect();

for (const ppId of [15, 25, 26]) {
  const pp = await c.query(
    `SELECT id, numero_registro, numero_proforma, pares_comprometidos, estado, quincena_arribo_id
     FROM pedido_proveedor WHERE id = $1`,
    [ppId],
  );
  const fi = await c.query(
    `SELECT COUNT(*)::int AS n_fi, COALESCE(SUM(total_pares), 0)::int AS pares_fi
     FROM factura_interna WHERE pp_id = $1`,
    [ppId],
  );
  const ppd = await c.query(
    "SELECT COUNT(*)::int AS n_skus FROM pedido_proveedor_detalle WHERE pedido_proveedor_id = $1",
    [ppId],
  );
  const ev = await c.query(
    `SELECT ic.precio_evento_id, COUNT(*)::int AS n
     FROM intencion_compra_pedido icp
     JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
     WHERE icp.pedido_proveedor_id = $1
     GROUP BY ic.precio_evento_id`,
    [ppId],
  );
  const pe = await c.query(
    `SELECT pe.id, pe.nombre_evento, pe.estado,
            (SELECT COUNT(*)::int FROM precio_lista pl WHERE pl.evento_id = pe.id) AS n_pl
     FROM precio_evento pe
     WHERE pe.id = (SELECT MIN(ic.precio_evento_id) FROM intencion_compra_pedido icp
                    JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
                    WHERE icp.pedido_proveedor_id = $1)`,
    [ppId],
  );
  console.log(
    JSON.stringify({
      pp: pp.rows[0],
      eventos_ic: ev.rows,
      listado: pe.rows[0],
      ppd: ppd.rows[0],
      fi: fi.rows[0],
    }),
  );
}

await c.end();
