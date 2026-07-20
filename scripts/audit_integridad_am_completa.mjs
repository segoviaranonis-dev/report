/**
 * Auditoría integridad Alejandro Magno — holding + vista Calzado + PP.
 * Uso: node scripts/audit_integridad_am_completa.mjs
 */
import fs from "fs";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import { getHerramientaReposicion } from "../src/lib/herramienta-reposicion/queries.ts";
import { reposicionArticuloToDepositoRow } from "../src/lib/herramienta-reposicion/reposicion-a-deposito-row.ts";
import {
  applyOperativaFilters,
  EMPTY_OPERATIVA_FILTERS,
} from "../src/lib/depositos/operativa-filters.ts";
import {
  auditarIntegridadReposicion,
  kpisDesdeArticulos,
  paresStockDesdeArticulo,
  paresTotalesAmDesdeArticulo,
  valorInventarioDesdeArticulos,
} from "../src/lib/herramienta-reposicion/totales-reposicion.ts";
import { moleculeKeyVentas } from "../src/lib/clientes/etiqueta-comprador.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = fs
  .readFileSync(path.resolve(__dirname, "../.env.local"), "utf8")
  .match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

function assertLeq(label, vista, holding) {
  if (vista > holding) {
    console.error(`FAIL ${label}: vista ${vista} > holding ${holding} (delta +${vista - holding})`);
    return false;
  }
  return true;
}

const { articulos, kpis } = await getHerramientaReposicion(pool);
const holding = kpisDesdeArticulos(articulos);
const issues = auditarIntegridadReposicion(articulos);

const sumStock =
  holding.peDisponible + holding.cpDisponible + holding.ppAbierto;
const sumAm =
  holding.peDisponible +
  holding.cpDisponible +
  holding.ppAbierto +
  holding.cpVendido +
  holding.programado;

const sumStockMolecular = articulos.reduce((s, a) => s + paresStockDesdeArticulo(a), 0);
const sumAmMolecular = articulos.reduce((s, a) => s + paresTotalesAmDesdeArticulo(a), 0);

const filtCalzado = { ...EMPTY_OPERATIVA_FILTERS, tipoV2Ids: [1] };
const rows = articulos.map(reposicionArticuloToDepositoRow);
const filteredRows = applyOperativaFilters(rows, filtCalzado, undefined, {
  incluirVendidoSinSaldo: true,
});
const byKey = new Map(articulos.map((a) => [a.key, a]));
const vistaArticulos = [];
for (const r of filteredRows) {
  const k = moleculeKeyVentas(
    r.linea_codigo_proveedor,
    r.referencia_codigo_proveedor,
    r.material_code,
    r.color_code,
  );
  const a = byKey.get(k);
  if (a) vistaArticulos.push(a);
}
const vista = kpisDesdeArticulos(vistaArticulos);

const ok =
  JSON.stringify(kpis) === JSON.stringify(holding) &&
  issues.length === 0 &&
  sumStock === sumStockMolecular &&
  sumAm === sumAmMolecular &&
  assertLeq("pe", vista.peDisponible, holding.peDisponible) &&
  assertLeq("cp", vista.cpDisponible, holding.cpDisponible) &&
  assertLeq("pp", vista.ppAbierto, holding.ppAbierto) &&
  assertLeq("vend", vista.cpVendido, holding.cpVendido) &&
  assertLeq("prog", vista.programado, holding.programado);

const valorInv = valorInventarioDesdeArticulos(articulos);

console.log(
  JSON.stringify(
    {
      ok,
      holding,
      vista_calzado: vista,
      moleculas_vista: vistaArticulos.length,
      sum_stock: sumStock,
      sum_am: sumAm,
      valor_inventario_gs: Math.round(valorInv * 100) / 100,
      issues_count: issues.length,
      issues_sample: issues.slice(0, 3),
      api_kpis_match: JSON.stringify(kpis) === JSON.stringify(holding),
    },
    null,
    2,
  ),
);

await pool.end();
process.exit(ok ? 0 : 1);
