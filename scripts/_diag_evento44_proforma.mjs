import fs from "fs";
import pg from "pg";

const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const c = new pg.Client({ connectionString: url });
await c.connect();

const EVENTO_ID = Number(process.env.DIAG_EVENTO ?? 45);

const ev = await c.query(
  "SELECT id, nombre_evento, estado, biblioteca_precio_id FROM precio_evento WHERE id = $1",
  [EVENTO_ID],
);
console.log(`EVENTO ${EVENTO_ID}:`, ev.rows[0]);

const pl = await c.query(
  `SELECT COUNT(*)::int AS c,
          COUNT(*) FILTER (WHERE COALESCE(lpn, 0) > 0)::int AS con_lpn
   FROM precio_lista WHERE evento_id = $1`,
  [EVENTO_ID],
);
console.log("PRECIO_LISTA:", pl.rows[0]);

const st = await c.query(
  "SELECT COUNT(*)::int AS c FROM precio_lista_staging WHERE evento_id = $1",
  [EVENTO_ID],
);
console.log("STAGING paso3:", st.rows[0]);

const sku = await c.query(
  "SELECT COUNT(*)::int AS c FROM precio_evento_sku_excel WHERE evento_id = $1",
  [EVENTO_ID],
);
console.log("SKU excel evento:", sku.rows[0]);

const recent = await c.query(
  "SELECT id, nombre_evento, estado FROM precio_evento ORDER BY id DESC LIMIT 6",
);
console.log("Eventos recientes:", recent.rows);

const pps = await c.query(`
  SELECT pp.id, pp.numero_registro, pp.estado, pp.numero_proforma, pp.categoria_id,
         pp.pares_comprometidos, pp.quincena_arribo_id,
         COUNT(DISTINCT ic.id)::int AS n_ics,
         SUM(ic.cantidad_total_pares)::int AS pares_ic,
         MIN(ic.precio_evento_id) AS ev_min,
         MAX(ic.precio_evento_id) AS ev_max
  FROM pedido_proveedor pp
  JOIN intencion_compra_pedido icp ON icp.pedido_proveedor_id = pp.id
  JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
  WHERE ic.precio_evento_id = $1 OR icp.precio_evento_id = $1
  GROUP BY pp.id
  ORDER BY pp.id DESC
  LIMIT 5`, [EVENTO_ID]);
console.log("PPs evento 44:", pps.rows);

const ppRecent = await c.query(`
  SELECT pp.id, pp.numero_registro, pp.estado, pp.categoria_id,
         COUNT(DISTINCT ic.id)::int AS n_ics
  FROM pedido_proveedor pp
  JOIN intencion_compra_pedido icp ON icp.pedido_proveedor_id = pp.id
  JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
  WHERE pp.categoria_id = 3
  GROUP BY pp.id
  ORDER BY pp.id DESC LIMIT 3`);
console.log("PP programado recientes:", ppRecent.rows);

const ppRow = pps.rows[0] ?? ppRecent.rows[0];
if (ppRow) {
  const ppId = ppRow.id;
  const ppd = await c.query(
    "SELECT COUNT(*)::int AS c FROM pedido_proveedor_detalle WHERE pedido_proveedor_id = $1",
    [ppId],
  );
  const fi = await c.query(
    "SELECT COUNT(*)::int AS c FROM factura_interna WHERE pp_id = $1",
    [ppId],
  );
  console.log(`PP ${ppId} PPD:`, ppd.rows[0].c, "FI:", fi.rows[0].c);

  const ics = await c.query(
    `SELECT ic.numero_registro, ic.id_cliente, ic.cantidad_total_pares,
            ic.precio_evento_id, ic.listado_precio_id
     FROM intencion_compra_pedido icp
     JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
     WHERE icp.pedido_proveedor_id = $1
     ORDER BY ic.id_cliente`,
    [ppId],
  );
  console.log("IC count:", ics.rowCount);
  console.log("IC sample:", ics.rows.slice(0, 6));

  const evIds = [...new Set(ics.rows.map((r) => r.precio_evento_id))];
  console.log("evento_ids en ICs:", evIds);

  const evId = Number(ics.rows[0]?.precio_evento_id ?? EVENTO_ID);
  const ppdConPrecio = await c.query(
    `SELECT COUNT(*)::int AS c
     FROM pedido_proveedor_detalle ppd
     JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
     LEFT JOIN linea l ON l.proveedor_id = pp.proveedor_importacion_id AND l.codigo_proveedor::text = ppd.linea
     LEFT JOIN referencia ref ON ref.linea_id = l.id AND ref.codigo_proveedor::text = ppd.referencia
     LEFT JOIN material m ON m.proveedor_id = pp.proveedor_importacion_id AND m.codigo_proveedor::text = ppd.material_code
     LEFT JOIN precio_lista pl ON pl.evento_id = $2 AND pl.linea_id = l.id
                               AND pl.referencia_id = ref.id AND pl.material_id = m.id
     WHERE ppd.pedido_proveedor_id = $1 AND COALESCE(pl.lpn, 0) > 0`,
    [ppId, evId],
  );
  console.log(`PPD con match precio_lista evento ${evId}:`, ppdConPrecio.rows[0].c);

  const ic0484 = await c.query(
    `SELECT ic.id, ic.numero_registro, ic.id_cliente, ic.cantidad_total_pares, ic.precio_evento_id,
            icp.pedido_proveedor_id
     FROM intencion_compra ic
     LEFT JOIN intencion_compra_pedido icp ON icp.intencion_compra_id = ic.id
     WHERE ic.numero_registro LIKE 'IC-2026-048%'
     ORDER BY ic.numero_registro DESC LIMIT 10`,
  );
  console.log("IC 048x:", ic0484.rows);
}

await c.end();
