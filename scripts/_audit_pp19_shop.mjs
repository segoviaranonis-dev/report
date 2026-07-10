import fs from "fs";
import pg from "pg";

const ppId = Number(process.argv[2] ?? 28);
const shop = String(process.argv[3] ?? "286");

const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const c = new pg.Client({ connectionString: url });
await c.connect();

const pp = await c.query(
  `SELECT id, numero_registro, numero_proforma, categoria_id FROM pedido_proveedor WHERE id = $1`,
  [ppId],
);
console.log("PP:", pp.rows[0]);

const ic = await c.query(
  `
  SELECT ic.id, ic.numero_registro, ic.id_cliente, cv.descp_cliente,
         ic.cantidad_total_pares, ic.id_marca, mv.descp_marca AS marca_ic,
         ic.listado_precio_id
  FROM intencion_compra_pedido icp
  JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
  LEFT JOIN cliente_v2 cv ON cv.id_cliente = ic.id_cliente
  LEFT JOIN marca_v2 mv ON mv.id_marca = ic.id_marca
  WHERE icp.pedido_proveedor_id = $1 AND ic.id_cliente::text = $2
  ORDER BY ic.numero_registro`,
  [ppId, shop],
);
console.log("\n=== IC SHOP", shop, "===", ic.rowCount);
let icPares = 0;
for (const r of ic.rows) {
  icPares += Number(r.cantidad_total_pares ?? 0);
  console.log(`  ${r.numero_registro} | marca IC: ${r.marca_ic} | ${r.cantidad_total_pares}p | LP ${r.listado_precio_id}`);
}
console.log("IC pares sum:", icPares);

const fi = await c.query(
  `
  SELECT fi.id, fi.nro_factura, fi.estado, fi.total_pares, fi.marca AS fi_marca_cab,
         (SELECT COUNT(*)::int FROM factura_interna_detalle d WHERE d.factura_id = fi.id) AS n_lineas,
         (SELECT COUNT(DISTINCT ppd.id_marca)::int FROM factura_interna_detalle d
          JOIN pedido_proveedor_detalle ppd ON ppd.id = d.ppd_id WHERE d.factura_id = fi.id) AS n_marcas,
         (SELECT STRING_AGG(DISTINCT mv.descp_marca, ' / ' ORDER BY mv.descp_marca) FROM factura_interna_detalle d
          JOIN pedido_proveedor_detalle ppd ON ppd.id = d.ppd_id
          JOIN marca_v2 mv ON mv.id_marca = ppd.id_marca
          WHERE d.factura_id = fi.id) AS marcas_detalle
  FROM factura_interna fi
  WHERE fi.pp_id = $1 AND fi.cliente_id::text = $2
  ORDER BY fi.id`,
  [ppId, shop],
);
console.log("\n=== FI SHOP", shop, "===", fi.rowCount);
let fiPares = 0;
for (const r of fi.rows) {
  fiPares += Number(r.total_pares ?? 0);
  console.log(
    `  FI ${r.id} ${r.nro_factura} | ${r.estado} | ${r.total_pares}p | cab:${r.fi_marca_cab} | det:${r.n_marcas} marcas → ${r.marcas_detalle}`,
  );
}
console.log("FI pares sum:", fiPares);

const snap = await c.query(`SELECT filas FROM pp_proforma_filas WHERE pp_id = $1`, [ppId]);
const raw = snap.rows[0]?.filas;
const arr = typeof raw === "string" ? JSON.parse(raw) : (raw ?? []);
const shopRows = arr.filter((r) => String(r.shop ?? "").trim() === shop);
let profPares = 0;
const brands = new Map();
for (const r of shopRows) {
  profPares += Number(r.pairs ?? 0);
  const b = (r.brand ?? "").trim();
  brands.set(b, (brands.get(b) ?? 0) + Number(r.pairs ?? 0));
}
console.log("\n=== PROFORMA SHOP", shop, "===");
console.log("filas:", shopRows.length, "pares:", profPares);
for (const [b, p] of [...brands.entries()].sort()) console.log(`  ${b}: ${p}p`);

const ppd = await c.query(
  `
  SELECT COUNT(*)::int AS n, COALESCE(SUM(cantidad_pares), 0)::int AS pares,
         STRING_AGG(DISTINCT mv.descp_marca, ' / ' ORDER BY mv.descp_marca) AS marcas
  FROM pedido_proveedor_detalle ppd
  JOIN marca_v2 mv ON mv.id_marca = ppd.id_marca
  WHERE ppd.pedido_proveedor_id = $1 AND ppd.grades_json->>'_shop' = $2`,
  [ppId, shop],
);
console.log("\n=== PPD _shop", shop, "===", ppd.rows[0]);

const fiMulti = await c.query(
  `
  SELECT fi.id, fi.cliente_id, COUNT(DISTINCT ppd.id_marca)::int AS n_marcas,
         STRING_AGG(DISTINCT mv.descp_marca, ' / ' ORDER BY mv.descp_marca) AS marcas
  FROM factura_interna fi
  JOIN factura_interna_detalle fid ON fid.factura_id = fi.id
  JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
  JOIN marca_v2 mv ON mv.id_marca = ppd.id_marca
  WHERE fi.pp_id = $1
  GROUP BY fi.id, fi.cliente_id
  HAVING COUNT(DISTINCT ppd.id_marca) > 1
  ORDER BY n_marcas DESC`,
  [ppId],
);
console.log("\n=== FI CON 2+ MARCAS (PP completo) ===", fiMulti.rowCount);
for (const r of fiMulti.rows.slice(0, 15)) {
  console.log(`  FI ${r.id} shop ${r.cliente_id} | ${r.n_marcas} marcas: ${r.marcas}`);
}

const icSinFi = await c.query(
  `
  SELECT ic.numero_registro, ic.id_cliente, ic.cantidad_total_pares, mv.descp_marca
  FROM intencion_compra_pedido icp
  JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
  LEFT JOIN marca_v2 mv ON mv.id_marca = ic.id_marca
  WHERE icp.pedido_proveedor_id = $1
    AND NOT EXISTS (
      SELECT 1 FROM factura_interna fi
      JOIN intencion_compra ic2 ON ic2.id_cliente = fi.cliente_id
      WHERE fi.pp_id = $1 AND ic2.id = ic.id
    )
  ORDER BY ic.numero_registro`,
  [ppId],
);
console.log("\n=== IC SIN FI (join cliente) ===", icSinFi.rowCount);
for (const r of icSinFi.rows) console.log(`  ${r.numero_registro} shop ${r.id_cliente} ${r.descp_marca} ${r.cantidad_total_pares}p`);

console.log("\n=== PARIDAD SHOP", shop, "===");
console.log({ ic: ic.rowCount, fi: fi.rowCount, icPares, fiPares, profPares, ppdPares: ppd.rows[0]?.pares });

await c.end();
