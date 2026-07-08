/**
 * Smoke Alejandro Magno — PE en PPD post MIG-140
 */
import pg from "pg";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const pe = await pool.query(`
  SELECT COUNT(*)::int AS filas,
         COUNT(DISTINCT pp.deposito_codigo)::int AS depositos,
         COALESCE(SUM(GREATEST(0, ppd.cantidad_pares - COALESCE(ppd.pares_vendidos,0))),0)::numeric AS uds
  FROM pedido_proveedor_detalle ppd
  JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
  JOIN quincena_arribo qa ON qa.id = pp.quincena_arribo_id
  WHERE pp.entidad_comercial = 'STOCK'
    AND pp.deposito_codigo IS NOT NULL
    AND lower(trim(qa.descripcion)) = lower('Pronta entrega')
`);

const staging = await pool.query(`SELECT COUNT(*)::int AS n FROM stock_pronta_entrega_rimec WHERE cantidad > 0`);
const mapped = await pool.query(`SELECT COUNT(*)::int AS n FROM stock_pe_staging_migrated`);
const peView = await pool.query(`
  SELECT EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'v_stock_pe_rimec') AS exists
`);
const cp = await pool.query(`SELECT COUNT(*)::int AS n FROM v_stock_rimec`);

console.log("PE PPD:", pe.rows[0]);
console.log("staging saldo:", staging.rows[0]);
console.log("mapped:", mapped.rows[0]);
console.log("v_stock_pe_rimec:", peView.rows[0].exists);
console.log("v_stock_rimec CP:", cp.rows[0]);

await pool.end();
