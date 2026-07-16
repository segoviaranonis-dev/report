import pg from "pg";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (t.startsWith("DATABASE_URL=")) {
      process.env.DATABASE_URL = t.slice(13).trim().replace(/^["']|["']$/g, "");
    }
  }
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await pool.query(readFileSync(resolve(root, "migrations/165_am_modo_venta_grada_abierta.sql"), "utf8"));
console.log("OK MIG-165");

const { rowCount } = await pool.query(`
  UPDATE pedido_proveedor_detalle ppd
  SET
    am_modo_venta = 'UNIDAD',
    am_talle = COALESCE(
      NULLIF(btrim(substring(ppd.grada from '^([0-9]+)')), ''),
      NULLIF(btrim(substring(ppd.grada from '^([A-Za-z]+)')), '')
    ),
    am_unidad_venta = 1,
    grades_json = COALESCE(
      ppd.grades_json,
      jsonb_build_object(
        COALESCE(
          NULLIF(btrim(substring(ppd.grada from '^([0-9]+)')), ''),
          NULLIF(btrim(substring(ppd.grada from '^([A-Za-z]+)')), ''),
          'T'
        ),
        GREATEST(0, COALESCE(ppd.cantidad_pares, 0) - COALESCE(ppd.pares_vendidos, 0))::int
      )
    ),
    precio_lpn = COALESCE(ppd.precio_lpn, ppd.unit_fob_ajustado),
    cantidad_cajas = 0
  FROM pedido_proveedor pp
  WHERE pp.id = ppd.pedido_proveedor_id
    AND pp.proveedor_importacion_id = 638
    AND pp.entidad_comercial = 'STOCK'
    AND (ppd.am_modo_venta IS NULL OR ppd.am_modo_venta <> 'UNIDAD')
`);
console.log("Backfill 638 PPD:", rowCount);

await pool.end();
