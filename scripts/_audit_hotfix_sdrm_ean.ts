import { readFileSync } from 'fs'
import { expandPeSdrmCsv } from '../src/lib/stock-pronta-entrega/pe-sdrm-pilares'

const text = readFileSync('Z:/hector/sdrm0218.csv', 'latin1')
const all = expandPeSdrmCsv(text, 'sdrm0218.csv')
const rawLines = text.split(/\r?\n/).length - 1

let skippedEan = 0
let skipped638only = 0
for (const line of text.split(/\r?\n/).slice(1)) {
  if (!line.trim()) continue
  const parts = line.split('|')
  const cb = (parts[0] ?? '').trim()
  const pref = cb.split('.')[0]
  const prov = (parts[1] ?? '').trim()
  if (prov === '106305') {
    if (pref !== '638') skippedEan++
    else skipped638only++
  }
}

const m305 = all.filter((l) => l.cod_art_proveedor.trim() === '106305')
console.log({
  rawLines,
  expandedTotal: all.length,
  m305Expanded: m305.length,
  m305Colors: [...new Set(m305.map((x) => x.excel_col))],
  m305D3Qty: m305.filter((x) => x.deposito_codigo === 'D3').reduce((a, x) => a + x.cantidad, 0),
  skippedEan106305: skippedEan,
  kept638prefix106305: skipped638only,
})
