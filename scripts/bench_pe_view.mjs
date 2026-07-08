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

const t0 = Date.now()
const r = await pool.query(`
  SELECT det_id, descp_marca, cajas_disponibles, material_code
  FROM v_stock_pe_rimec
  WHERE cajas_disponibles > 0
  ORDER BY det_id
  LIMIT 80
`)
console.log('direct 80 rows:', r.rowCount, 'ms:', Date.now() - t0)

const t1 = Date.now()
const r2 = await pool.query(`
  SELECT marca_id, descp_marca, linea_id, linea_codigo, grupo_estilo_id, descp_grupo_estilo,
         tipo_1_id, descp_tipo_1, descp_color, quincena_arribo_id, quincena_desc, deposito_nombre,
         cajas_disponibles, cantidad_pares, pares_vendidos, pares_por_caja, cantidad_cajas
  FROM v_stock_pe_rimec
  WHERE cajas_disponibles > 0
  ORDER BY det_id
  LIMIT 1000
`)
console.log('meta 1000 rows:', r2.rowCount, 'ms:', Date.now() - t1)

await pool.end()
