import pg from 'pg'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(resolve(root, '.env.local'), 'utf8').split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('=')
  if (eq <= 0) continue
  process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const counts = await pool.query(`
  SELECT
    (SELECT count(*) FROM pedido_proveedor) AS pp_total,
    (SELECT count(*) FROM pedido_proveedor_detalle) AS ppd_total,
    (SELECT count(*) FROM pedido_proveedor pp
      JOIN quincena_arribo qa ON qa.id = pp.quincena_arribo_id
      WHERE pp.entidad_comercial = 'STOCK'
        AND pp.deposito_codigo IS NOT NULL
        AND pp.estado_transito = 'EN_DEPOSITO'
        AND pp.categoria_id = 1
        AND lower(trim(qa.descripcion)) = lower('Pronta entrega')) AS pp_pe,
    (SELECT count(*) FROM pedido_proveedor_detalle ppd
      JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
      JOIN quincena_arribo qa ON qa.id = pp.quincena_arribo_id
      WHERE pp.entidad_comercial = 'STOCK'
        AND pp.deposito_codigo IS NOT NULL
        AND pp.estado_transito = 'EN_DEPOSITO'
        AND pp.categoria_id = 1
        AND lower(trim(qa.descripcion)) = lower('Pronta entrega')
        AND GREATEST(0, COALESCE(ppd.cantidad_pares, 0) - COALESCE(ppd.pares_vendidos, 0)) > 0) AS ppd_pe_vendible
`)
console.log('counts:', counts.rows[0])

const explain = await pool.query(`
  EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
  SELECT det_id, descp_marca, cajas_disponibles
  FROM v_stock_pe_rimec
  WHERE cajas_disponibles > 0
  ORDER BY det_id
  LIMIT 80
`)
console.log('\nEXPLAIN 80 rows:')
for (const row of explain.rows) console.log(row['QUERY PLAN'])

await pool.end()
