import fs from "fs";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import { getHerramientaReposicion } from "../src/lib/herramienta-reposicion/queries.ts";
import { reposicionArticuloToDepositoRow } from "../src/lib/herramienta-reposicion/reposicion-a-deposito-row.ts";
import { applyOperativaFilters, EMPTY_OPERATIVA_FILTERS } from "../src/lib/depositos/operativa-filters.ts";
import { kpisDesdeArticulos } from "../src/lib/herramienta-reposicion/totales-reposicion.ts";
import { moleculeKeyVentas } from "../src/lib/clientes/etiqueta-comprador.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = fs.readFileSync(path.resolve(__dirname, "../.env.local"), "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
const d = await getHerramientaReposicion(pool);

const filt = { ...EMPTY_OPERATIVA_FILTERS, tipoV2Ids: [1] };
const rows = d.articulos.map(reposicionArticuloToDepositoRow);
const filtered = applyOperativaFilters(rows, filt, undefined, { incluirVendidoSinSaldo: true });
const byKey = new Map(d.articulos.map((a) => [a.key, a]));
let ppInFiltered = 0;
for (const r of filtered) {
  const k = moleculeKeyVentas(r.linea_codigo_proveedor, r.referencia_codigo_proveedor, r.material_code, r.color_code);
  const a = byKey.get(k);
  if (a) ppInFiltered += a.totales.ppAbierto;
}
console.log("ppAll", d.kpis.ppAbierto, "ppInFilteredRows", ppInFiltered, "filtered", filtered.length);
await pool.end();
