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

const r = await pool.query(`
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE tablename IN ('linea', 'material', 'color', 'referencia', 'pedido_proveedor', 'pedido_proveedor_detalle')
    AND schemaname = 'public'
  ORDER BY tablename, indexname
`)
for (const row of r.rows) console.log(row.indexname, '\n ', row.indexdef, '\n')

await pool.end()
