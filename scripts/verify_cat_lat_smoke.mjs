/**
 * Smoke CAT-LAT T2–T7 — RPC meta, ramo_tipo, enrich vista, grada PE.
 * Uso: node report/scripts/verify_cat_lat_smoke.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (!m) continue
  let v = m[2].trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!process.env[m[1].trim()]) process.env[m[1].trim()] = v
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

let fail = 0
function ok(label, cond) {
  if (cond) console.log(`  OK  ${label}`)
  else { console.log(` FAIL ${label}`); fail++ }
}

async function main() {
  console.log('=== CAT-LAT smoke BD ===\n')

  const t0 = Date.now()
  const rpcPe = await pool.query(
    `SELECT public.rimec_catalogo_meta(true, NULL, NULL, NULL, NULL, NULL, 'CALZADO', NULL, NULL) AS m`,
  )
  const peMeta = rpcPe.rows[0]?.m
  ok('RPC PE CALZADO', (peMeta?.marcas?.length ?? 0) > 0)
  console.log(`  RPC PE ms: ${Date.now() - t0} · marcas: ${peMeta?.marcas?.length ?? 0}`)

  const t1 = Date.now()
  const rpcCp = await pool.query(
    `SELECT public.rimec_catalogo_meta(false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL) AS m`,
  )
  const cpMeta = rpcCp.rows[0]?.m
  ok('RPC CP', (cpMeta?.marcas?.length ?? 0) > 0)
  console.log(`  RPC CP ms: ${Date.now() - t1} · marcas: ${cpMeta?.marcas?.length ?? 0}`)

  const peSample = await pool.query(`
    SELECT ramo_tipo, genero_codigo, grada
    FROM v_stock_pe_rimec
    WHERE ramo_tipo = 'CALZADO' AND grada IS NOT NULL
    LIMIT 5
  `)
  ok('PE ramo_tipo + grada', peSample.rows.length > 0)

  const cpSample = await pool.query(`
    SELECT ramo_tipo, genero_codigo
    FROM v_stock_rimec LIMIT 5
  `)
  ok('CP ramo_tipo CALZADO', cpSample.rows.every(r => r.ramo_tipo === 'CALZADO'))

  const peGen = await pool.query(`
    SELECT COUNT(*)::int AS n FROM v_stock_pe_rimec WHERE genero_codigo IS NOT NULL
  `)
  ok('PE genero_codigo > 1000', peGen.rows[0].n > 1000)

  const peGrada = await pool.query(`
    SELECT COUNT(*)::int AS n FROM v_stock_pe_rimec WHERE grada IS NOT NULL AND btrim(grada) <> ''
  `)
  ok('PE con grada ~12k', peGrada.rows[0].n > 10000)

  console.log(fail ? `\nFAIL ${fail} checks` : '\nTODOS OK')
  await pool.end()
  process.exit(fail ? 1 : 0)
}

main().catch(async e => {
  console.error(e)
  await pool.end()
  process.exit(1)
})
