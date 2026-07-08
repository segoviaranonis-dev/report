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
  SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('linea', 'material', 'color', 'referencia', 'pedido_proveedor_detalle')
    AND column_name IN ('codigo_proveedor', 'linea', 'material_code', 'color_code', 'referencia')
  ORDER BY table_name, column_name
`)
console.table(r.rows)

await pool.end()
