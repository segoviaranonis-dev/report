import fs from "fs";
import pg from "pg";

const ppId = Number(process.argv[2] ?? 28);
const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const c = new pg.Client({ connectionString: url });
await c.connect();

const pp = await c.query(`SELECT numero_registro, numero_proforma FROM pedido_proveedor WHERE id=$1`, [ppId]);
console.log("=== AUDITORÍA PP", pp.rows[0]?.numero_registro, "proforma", pp.rows[0]?.numero_proforma, "===\n");

const tot = await c.query(`
  SELECT
    (SELECT COUNT(*)::int FROM intencion_compra_pedido WHERE pedido_proveedor_id=$1) AS n_ic,
    (SELECT COUNT(*)::int FROM factura_interna WHERE pp_id=$1) AS n_fi,
    (SELECT COALESCE(SUM(cantidad_total_pares),0)::int FROM intencion_compra ic
     JOIN intencion_compra_pedido icp ON icp.intencion_compra_id=ic.id WHERE icp.pedido_proveedor_id=$1) AS ic_pares,
    (SELECT COALESCE(SUM(total_pares),0)::int FROM factura_interna WHERE pp_id=$1) AS fi_pares,
    (SELECT COALESCE(SUM(cantidad_pares),0)::int FROM pedido_proveedor_detalle WHERE pedido_proveedor_id=$1) AS ppd_pares
`, [ppId]);
console.log("TOTALES:", tot.rows[0]);

const snap = await c.query(`SELECT filas FROM pp_proforma_filas WHERE pp_id=$1`, [ppId]);
const raw = snap.rows[0]?.filas;
const prof = typeof raw === "string" ? JSON.parse(raw) : (raw ?? []);
let profPares = 0;
for (const r of prof) profPares += Number(r.pairs ?? 0);
console.log("PROFORMA snapshot:", prof.length, "filas,", profPares, "pares\n");

const fiMulti = await c.query(`
  SELECT COUNT(*)::int AS n FROM (
    SELECT fi.id FROM factura_interna fi
    JOIN factura_interna_detalle fid ON fid.factura_id=fi.id
    JOIN pedido_proveedor_detalle ppd ON ppd.id=fid.ppd_id
    WHERE fi.pp_id=$1
    GROUP BY fi.id HAVING COUNT(DISTINCT ppd.id_marca)>1
  ) t`, [ppId]);
console.log("FI con 2+ marcas:", fiMulti.rows[0].n, "de", tot.rows[0].n_fi);

const icMarcaMismatch = await c.query(`
  WITH fi_m AS (
    SELECT fi.id AS fi_id, fi.cliente_id,
           STRING_AGG(DISTINCT UPPER(TRIM(mv.descp_marca)), ' / ' ORDER BY UPPER(TRIM(mv.descp_marca))) AS marcas_fi
    FROM factura_interna fi
    JOIN factura_interna_detalle fid ON fid.factura_id=fi.id
    JOIN pedido_proveedor_detalle ppd ON ppd.id=fid.ppd_id
    JOIN marca_v2 mv ON mv.id_marca=ppd.id_marca
    WHERE fi.pp_id=$1
    GROUP BY fi.id, fi.cliente_id
  ),
  ic_shop AS (
    SELECT ic.id_cliente, ic.numero_registro, UPPER(TRIM(mv.descp_marca)) AS marca_ic,
           ic.cantidad_total_pares, fi_m.fi_id, fi_m.marcas_fi
    FROM intencion_compra_pedido icp
    JOIN intencion_compra ic ON ic.id=icp.intencion_compra_id
    JOIN marca_v2 mv ON mv.id_marca=ic.id_marca
    LEFT JOIN fi_m ON fi_m.cliente_id=ic.id_cliente
    WHERE icp.pedido_proveedor_id=$1
  )
  SELECT * FROM ic_shop
  WHERE marcas_fi IS NOT NULL
    AND marcas_fi NOT LIKE '%' || marca_ic || '%'
  ORDER BY id_cliente, numero_registro
  LIMIT 20`, [ppId]);
console.log("\nIC cuya marca NO está en FI detalle (muestra 20):", icMarcaMismatch.rowCount);
for (const r of icMarcaMismatch.rows) {
  console.log(`  ${r.numero_registro} shop ${r.id_cliente} | IC marca: ${r.marca_ic} | FI marcas: ${r.marcas_fi}`);
}

const shop286 = prof.filter((r) => String(r.shop).trim() === "286");
const brands286 = new Map();
for (const r of shop286) {
  const b = (r.brand ?? "(vacío)").trim();
  brands286.set(b, (brands286.get(b) ?? 0) + Number(r.pairs ?? 0));
}
console.log("\n--- SHOP 286 proforma por marca ---");
for (const [b, p] of [...brands286.entries()].sort()) console.log(`  ${b}: ${p}p`);

const ic286 = await c.query(`
  SELECT ic.numero_registro, mv.descp_marca, ic.cantidad_total_pares
  FROM intencion_compra_pedido icp
  JOIN intencion_compra ic ON ic.id=icp.intencion_compra_id
  JOIN marca_v2 mv ON mv.id_marca=ic.id_marca
  WHERE icp.pedido_proveedor_id=$1 AND ic.id_cliente=286`, [ppId]);
console.log("\n--- SHOP 286 IC ---");
for (const r of ic286.rows) console.log(`  ${r.numero_registro} ${r.descp_marca} ${r.cantidad_total_pares}p`);

const fi286 = await c.query(`
  SELECT fi.id, fi.total_pares,
    (SELECT STRING_AGG(DISTINCT mv.descp_marca,' / ' ORDER BY mv.descp_marca)
     FROM factura_interna_detalle d JOIN pedido_proveedor_detalle ppd ON ppd.id=d.ppd_id
     JOIN marca_v2 mv ON mv.id_marca=ppd.id_marca WHERE d.factura_id=fi.id) AS marcas
  FROM factura_interna fi WHERE fi.pp_id=$1 AND fi.cliente_id=286`, [ppId]);
console.log("\n--- SHOP 286 FI ---");
for (const r of fi286.rows) console.log(`  FI ${r.id} ${r.total_pares}p → ${r.marcas}`);

const icSinFi = await c.query(`
  SELECT ic.numero_registro, ic.id_cliente, mv.descp_marca, ic.cantidad_total_pares
  FROM intencion_compra_pedido icp
  JOIN intencion_compra ic ON ic.id=icp.intencion_compra_id
  LEFT JOIN marca_v2 mv ON mv.id_marca=ic.id_marca
  WHERE icp.pedido_proveedor_id=$1
    AND NOT EXISTS (
      SELECT 1 FROM factura_interna fi
      WHERE fi.pp_id=$1 AND fi.cliente_id=ic.id_cliente
        AND ABS(fi.total_pares - ic.cantidad_total_pares) <= 50
    )
  ORDER BY ic.numero_registro`, [ppId]);
console.log("\nIC sin FI par (cliente+cupo):", icSinFi.rowCount);
for (const r of icSinFi.rows) console.log(`  ${r.numero_registro} shop ${r.id_cliente} ${r.descp_marca} ${r.cantidad_total_pares}p`);

console.log("\n=== CAUSA RAÍZ (código) ===");
console.log("buildProgramadoFiJobs agrupa por SHOP solamente — NO filtra filas proforma por marca IC.");
console.log("1 IC × shop con proforma multi-marca → FI mezcla todas las marcas del SHOP.");
console.log("Deuda documentada: CHUSAR_CSV § Paridad marca×caso · OT aparte.");

await c.end();
