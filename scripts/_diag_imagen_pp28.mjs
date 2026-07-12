import fs from "fs";
import pg from "pg";

const env = fs.readFileSync(".env.local", "utf8");
const dbUrl = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const supa = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim()?.replace(/\/$/, "");
const pool = new pg.Pool({ connectionString: dbUrl });

const ppd = await pool.query(`
  SELECT linea, referencia, material_code, color_code
  FROM pedido_proveedor_detalle WHERE pedido_proveedor_id = 28
  AND material_code IS NOT NULL AND TRIM(material_code::text) <> ''
  LIMIT 8
`);
console.log("PPD sample", ppd.rows);

const snapStats = await pool.query(`
  SELECT
    COUNT(*)::int total,
    COUNT(*) FILTER (WHERE linea_snapshot::text ILIKE '%material_code%')::int con_mat,
    COUNT(*) FILTER (WHERE linea_snapshot::text ILIKE '%color_code%')::int con_col
  FROM factura_interna_detalle fid
  JOIN factura_interna fi ON fi.id = fid.factura_id
  WHERE fi.pp_id = 28
`);
console.log("FI snapshot stats", snapStats.rows[0]);

const snap = await pool.query(`
  SELECT fid.linea_snapshot::text AS snap
  FROM factura_interna_detalle fid
  JOIN factura_interna fi ON fi.id = fid.factura_id
  WHERE fi.pp_id = 28 LIMIT 2
`);
console.log("FI snap sample", snap.rows.map((r) => r.snap));

let ok = 0;
let fail = 0;
for (const r of ppd.rows.slice(0, 5)) {
  const stem = [r.linea, r.referencia, r.material_code, r.color_code]
    .map((x) => String(x ?? "").trim())
    .join("-");
  const urls = [
    `${supa}/storage/v1/object/public/productos/sm/${stem}.jpg`,
    `${supa}/storage/v1/object/public/productos/${stem}.jpg`,
  ];
  let hit = false;
  for (const url of urls) {
    const res = await fetch(url, { method: "HEAD" });
    if (res.ok) {
      console.log("OK", stem, res.status);
      hit = true;
      ok++;
      break;
    }
  }
  if (!hit) {
    console.log("MISS", stem);
    fail++;
  }
}
console.log(`Storage probe: ${ok} ok, ${fail} miss of ${Math.min(5, ppd.rows.length)}`);

await pool.end();
