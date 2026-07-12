/**
 * Backfill linea_snapshot FI — material_code · color_code · grades_json desde PPD.
 * Uso: node scripts/backfill_fi_snapshot_imagen.mjs [ppId]
 */
import fs from "fs";
import pg from "pg";

const ppId = Number(process.argv[2] || 28);
const env = fs.readFileSync(".env.local", "utf8");
const dbUrl = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const pool = new pg.Pool({ connectionString: dbUrl });

const { rowCount } = await pool.query(
  `
  UPDATE factura_interna_detalle fid
  SET linea_snapshot = COALESCE(fid.linea_snapshot, '{}'::jsonb)
    || jsonb_build_object(
      'material_code', COALESCE(TRIM(ppd.material_code::text), ''),
      'color_code', COALESCE(TRIM(ppd.color_code::text), ''),
      'grades_json', COALESCE(ppd.grades_json, '{}'::jsonb) - '_shop' - '_brand' - '_item'
    )
  FROM factura_interna fi, pedido_proveedor_detalle ppd
  WHERE fi.id = fid.factura_id
    AND ppd.id = fid.ppd_id
    AND fi.pp_id = $1
  `,
  [ppId],
);

const stats = await pool.query(
  `
  SELECT
    COUNT(*)::int total,
    COUNT(*) FILTER (WHERE fid.linea_snapshot ? 'material_code' AND TRIM(fid.linea_snapshot->>'material_code') <> '')::int con_mat
  FROM factura_interna_detalle fid
  JOIN factura_interna fi ON fi.id = fid.factura_id
  WHERE fi.pp_id = $1
  `,
  [ppId],
);

console.log(`PP-${ppId}: backfill ${rowCount} filas FI detalle`);
console.log("Stats", stats.rows[0]);
await pool.end();
