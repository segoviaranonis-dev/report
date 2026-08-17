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

/** Ley Magno 2.3.1.22.1 — programado nunca en STOCK's / nunca en cpDisponible */
const PE_RE = /^pronta\s*entrega$/i;
const PP_LABEL = "PP abierto";
let programadoEnStock = 0;
const sampleProgEnStock = [];
for (const a of articulos) {
  const progLabels = new Set([
    ...(a.programadoSaldo ?? []).map((b) => b.label),
    ...a.ventasProgramado.map((b) => b.label),
  ]);
  for (const b of a.stock) {
    if (PE_RE.test(b.label) || b.label === PP_LABEL) continue;
    if (progLabels.has(b.label)) {
      programadoEnStock += b.pares;
      if (sampleProgEnStock.length < 5) {
        sampleProgEnStock.push({ key: a.key, label: b.label, pares: b.pares });
      }
    }
  }
}

/** Solo-programado (sin PE/CP/PP): cpDisponible debe ser 0 */
let molSoloProgConCpFantasma = 0;
for (const a of articulos) {
  const hasProg =
    (a.programadoSaldo ?? []).some((b) => b.pares > 0) ||
    a.ventasProgramado.some((b) => b.pares > 0);
  if (!hasProg) continue;
  const sinStockReal =
    a.totales.peDisponible === 0 &&
    a.totales.ppAbierto === 0 &&
    a.stock.filter((b) => !PE_RE.test(b.label) && b.label !== PP_LABEL).length === 0;
  if (sinStockReal && a.totales.cpDisponible > 0) molSoloProgConCpFantasma += 1;
}

const mol4117 = articulos.find((a) => a.key === "7230-100-29516-83517");
const caso4117 = mol4117
  ? {
      key: mol4117.key,
      cpDisponible: mol4117.totales.cpDisponible,
      programado: mol4117.totales.programado,
      stock_labels: mol4117.stock.map((b) => `${b.label}:${b.pares}`),
      programadoSaldo: (mol4117.programadoSaldo ?? []).map((b) => `${b.label}:${b.pares}`),
      ventasProgramado: mol4117.ventasProgramado.map((b) => `${b.label}:${b.pares}`),
      ok_no_stock_prog: !(mol4117.programadoSaldo ?? []).some((ps) =>
        mol4117.stock.some((s) => s.label === ps.label),
      ),
      ok_4117_en_programado:
        (mol4117.programadoSaldo ?? []).some((b) => String(b.label).includes("4117")) ||
        mol4117.ventasProgramado.some((b) => String(b.label).includes("4117")),
    }
  : { key: "7230-100-29516-83517", ausente: true };

const clasificacion_ok =
  programadoEnStock === 0 &&
  molSoloProgConCpFantasma === 0 &&
  (caso4117.ausente === true ||
    (caso4117.ok_no_stock_prog === true && caso4117.ok_4117_en_programado === true));

const ok =
  JSON.stringify(kpis) === JSON.stringify(holding) &&
  issues.length === 0 &&
  sumStock === sumStockMolecular &&
  sumAm === sumAmMolecular &&
  clasificacion_ok &&
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
      clasificacion_ok,
      programado_pares_en_stock: programadoEnStock,
      mol_solo_prog_cp_fantasma: molSoloProgConCpFantasma,
      sample_prog_en_stock: sampleProgEnStock,
      caso_4117: caso4117,
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
