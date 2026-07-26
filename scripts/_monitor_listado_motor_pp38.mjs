/**
 * Monitoreo PP-38 · por qué listado motor no cambia precio.
 * Uso: node scripts/_monitor_listado_motor_pp38.mjs [ppId]
 */
import fs from "fs";
import pg from "pg";

const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const pool = new pg.Pool({ connectionString: url });
const ppId = Number(process.argv[2] ?? 38);
const eventosProbar = [27, 28, 29, 30, 45, 47];

console.log(`\n=== MONITOR listado motor · PP-${ppId} ===\n`);

const { rows: fis } = await pool.query(
  `SELECT fi.id, fi.nro_factura, fi.total_monto, fi.cliente_id,
          ic.precio_evento_id AS ic_evento, pe.nombre_evento
   FROM factura_interna fi
   LEFT JOIN LATERAL (
     SELECT ic.precio_evento_id FROM intencion_compra ic
     JOIN intencion_compra_pedido icp ON icp.intencion_compra_id = ic.id
     WHERE icp.pedido_proveedor_id = fi.pp_id AND ic.id_cliente = fi.cliente_id
     ORDER BY ic.id LIMIT 1
   ) ic ON true
   LEFT JOIN precio_evento pe ON pe.id = ic.precio_evento_id
   WHERE fi.pp_id = $1 AND fi.estado IN ('RESERVADA','CONFIRMADA')
   ORDER BY fi.nro_factura LIMIT 10`,
  [ppId],
);

console.log(`FI muestra (${fis.length}):`);
for (const fi of fis) {
  console.log(`  ${fi.nro_factura} id=${fi.id} IC evento=#${fi.ic_evento ?? "?"} monto=${fi.total_monto}`);
}

const { rows: skuSample } = await pool.query(
  `SELECT DISTINCT ppd.linea, ppd.referencia, ppd.material_code
   FROM factura_interna_detalle fid
   JOIN factura_interna fi ON fi.id = fid.factura_id
   JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
   WHERE fi.pp_id = $1
   LIMIT 20`,
  [ppId],
);

console.log(`\nMoléculas únicas en FI (muestra ${skuSample.length}):`);

let totalChecks = 0;
let totalHits = 0;
const hitsPorEvento = Object.fromEntries(eventosProbar.map((e) => [e, 0]));

for (const sku of skuSample) {
  const key = `${sku.linea}/${sku.referencia}/mat${sku.material_code}`;
  const hits = [];
  for (const ev of eventosProbar) {
    totalChecks++;
    const pl = await pool.query(
      `SELECT pl.lpc03, pl.lpn
       FROM precio_lista pl
       WHERE pl.evento_id = $1
         AND TRIM(pl.linea_codigo) = TRIM($2::text)
         AND TRIM(pl.referencia_codigo) = TRIM($3::text)
       LIMIT 1`,
      [ev, sku.linea, sku.referencia],
    );
    if (pl.rowCount) {
      hits.push(`#${ev}(LPC03=${pl.rows[0].lpc03})`);
      hitsPorEvento[ev]++;
      totalHits++;
    }
  }
  console.log(`  ${key} → ${hits.length ? hits.join(", ") : "SIN MATCH en #27-30-45-47"}`);
}

console.log("\n=== Cobertura precio_lista (L+R) por evento ===");
for (const ev of eventosProbar) {
  const pct = skuSample.length ? Math.round((hitsPorEvento[ev] / skuSample.length) * 100) : 0;
  console.log(`  Evento #${ev}: ${hitsPorEvento[ev]}/${skuSample.length} SKUs (${pct}%)`);
}

const { rows: icRows } = await pool.query(
  `SELECT ic.id, ic.numero_registro, ic.id_cliente, ic.precio_evento_id, pe.nombre_evento
   FROM intencion_compra ic
   JOIN intencion_compra_pedido icp ON icp.intencion_compra_id = ic.id
   LEFT JOIN precio_evento pe ON pe.id = ic.precio_evento_id
   WHERE icp.pedido_proveedor_id = $1
   ORDER BY ic.numero_registro LIMIT 15`,
  [ppId],
);
console.log("\n=== IC vinculadas · precio_evento_id ===");
for (const ic of icRows) {
  console.log(`  ${ic.numero_registro} shop=${ic.id_cliente} evento=#${ic.precio_evento_id ?? "?"} ${ic.nombre_evento ?? ""}`);
}

console.log("\n=== CAUSA RAÍZ (si cobertura 0%) ===");
console.log("  El SKU L+R de las FI no existe en precio_lista de esos eventos.");
console.log("  El motor NO puede cambiar precio si la molécula no está en el listado elegido.");
console.log("  Solución: elegir evento que contenga las L+R del PP o vincular listado desde Stock.\n");

await pool.end();
