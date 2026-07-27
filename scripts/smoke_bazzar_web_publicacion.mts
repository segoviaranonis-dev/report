/**
 * Smoke pre-publicación Bazzar Web (Report) — cliente 5000.
 * npx tsx scripts/smoke_bazzar_web_publicacion.mts
 */
import pg from "pg";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { gradasFmtToTallas, scaleGradesToPares } from "../src/lib/rimec-abastecimiento/traspaso-mutations.ts";

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

let fail = 0;

function check(name: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"} · ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) fail += 1;
}

// 1) Lógica gradas
const g = gradasFmtToTallas("38(1 2 3 3 2 1)43");
const s = scaleGradesToPares(g, 12);
const sum = Object.values(s).reduce((a, b) => a + b, 0);
check("gradas 38-43 suma 12", sum === 12, `sum=${sum}`);

const g11 = scaleGradesToPares(gradasFmtToTallas("37/8(2-4-4-2)43/4"), 11);
check("escala grada 12→11 pares", Object.values(g11).reduce((a, b) => a + b, 0) === 11);

if (!process.env.DATABASE_URL) {
  console.log("\nSKIP BD — sin DATABASE_URL");
  process.exit(fail > 0 ? 1 : 0);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("localhost") ? undefined : { rejectUnauthorized: false },
});

const delta = await pool.query(`
  SELECT COUNT(*)::int AS n
  FROM (
    SELECT t.id
    FROM traspaso t
    JOIN factura_interna fi ON fi.nro_factura = t.documento_ref
    LEFT JOIN traspaso_detalle td ON td.traspaso_id = t.id
    WHERE t.almacen_destino_id = 1 AND fi.cliente_id = 5000 AND fi.total_pares > 0
    GROUP BY t.id, fi.total_pares
    HAVING COALESCE(SUM(td.cantidad), 0) <> fi.total_pares
  ) x
`);
check("TRP cliente 5000 sin delta FI", delta.rows[0].n === 0, `mismatch=${delta.rows[0].n}`);

const stock = await pool.query(`
  SELECT COALESCE(SUM(md.cantidad * md.signo), 0)::int AS pares
  FROM movimiento_detalle md
  JOIN movimiento m ON m.id = md.movimiento_id
  WHERE m.almacen_destino_id = 1 AND m.tipo = 'INGRESO_COMPRA' AND m.estado = 'CONFIRMADO'
`);
check("stock ALM_WEB movimientos", stock.rows[0].pares >= 0, `${stock.rows[0].pares} p`);

const precios = await pool.query(`
  SELECT COUNT(*)::int AS n FROM lista_precio lp WHERE lp.tipo = 'WEB' AND lp.activa = true
`);
check("lista precio WEB activa", precios.rows[0].n >= 1, `listas=${precios.rows[0].n}`);

await pool.end();
console.log(fail === 0 ? "\n✅ SMOKE BAZZAR WEB OK" : `\n❌ ${fail} fallo(s)`);
process.exit(fail > 0 ? 1 : 0);
