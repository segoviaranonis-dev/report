import fs from "fs";
import pg from "pg";

const ppId = 28;
const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const c = new pg.Client({ connectionString: url });
await c.connect();

const ppdBrand = await c.query(`
  SELECT COALESCE(NULLIF(TRIM(grades_json->>'_brand'), ''), '(vacío)') AS brand,
         COUNT(*)::int AS n, SUM(cantidad_pares)::int AS p
  FROM pedido_proveedor_detalle WHERE pedido_proveedor_id=$1
  GROUP BY 1 ORDER BY p DESC LIMIT 15`, [ppId]);
console.log("PPD brands:", ppdBrand.rows);

const snap = await c.query(`SELECT filas FROM pp_proforma_filas WHERE pp_id=$1`, [ppId]);
const arr = typeof snap.rows[0]?.filas === "string" ? JSON.parse(snap.rows[0].filas) : snap.rows[0]?.filas ?? [];
const withBrand = arr.filter((r) => (r.brand ?? "").trim()).length;
console.log("Snapshot:", arr.length, "filas, con brand:", withBrand);
if (arr[0]) console.log("Sample snap row keys:", Object.keys(arr[0]), "brand:", arr[0].brand);

const ppdSample = await c.query(`
  SELECT linea, referencia, material_code, color_code, grades_json->>'_brand' AS brand, grades_json->>'_shop' AS shop
  FROM pedido_proveedor_detalle WHERE pedido_proveedor_id=$1 LIMIT 3`, [ppId]);
console.log("PPD sample:", ppdSample.rows);

const shop286 = await c.query(`
  SELECT mv.descp_marca, COUNT(*)::int AS n, SUM(cantidad_pares)::int AS p
  FROM pedido_proveedor_detalle ppd
  JOIN marca_v2 mv ON mv.id_marca = ppd.id_marca
  WHERE ppd.pedido_proveedor_id = $1 AND ppd.grades_json->>'_shop' = '286'
  GROUP BY mv.descp_marca ORDER BY p DESC`, [ppId]);
console.log("Shop 286 PPD por id_marca:", shop286.rows);

await c.end();
