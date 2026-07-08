import pg from "pg";
import fs from "fs";

const pool = new pg.Pool({
  connectionString: fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim(),
});

const samples = await pool.query(`
SELECT fid.id, fid.linea_snapshot::text AS snap
FROM factura_interna_detalle fid
JOIN factura_interna fi ON fi.id = fid.factura_id
WHERE fi.pp_id = 15
  AND (
    fid.linea_snapshot::text ILIKE '%8524%'
    OR fid.linea_snapshot::text ILIKE '%8530%'
  )
LIMIT 6
`);
console.log("=== snapshots ===");
for (const r of samples.rows) {
  console.log("--- fid", r.id);
  console.log(r.snap?.slice(0, 400));
}

const withImg = await pool.query(`
SELECT
  COUNT(*)::int total,
  COUNT(*) FILTER (WHERE fid.linea_snapshot::text ILIKE '%imagen%')::int con_imagen_url,
  COUNT(*) FILTER (
    WHERE fid.linea_snapshot::text ~ 'linea_codigo|linea'
    AND fid.linea_snapshot::text ~ 'ref_codigo|referencia'
  )::int con_lr
FROM factura_interna_detalle fid
JOIN factura_interna fi ON fi.id = fid.factura_id
WHERE fi.pp_id = 15
`);
console.log("\n=== stats PP15 ===", withImg.rows[0]);

await pool.end();
