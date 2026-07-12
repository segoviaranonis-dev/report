/**
 * Smoke grilla Stock Programado — PPD cat. 3 + campos grilla.
 * Uso: node scripts/verify_stock_programado_grilla.mjs
 */
import pg from "pg";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

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

if (!process.env.DATABASE_URL) {
  console.error("FAIL: DATABASE_URL no configurada");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

let ok = true;
function fail(msg) {
  ok = false;
  console.error("FAIL:", msg);
}
function pass(msg) {
  console.log("OK:", msg);
}

try {
  const resumen = await pool.query(`
    SELECT
      COUNT(DISTINCT pp.id)::int AS pedidos_pp,
      COUNT(ppd.id)::int AS moleculas,
      COALESCE(SUM(ppd.cantidad_pares), 0)::numeric AS pares_inicial,
      COALESCE(SUM(GREATEST(
        COALESCE(ppd.pares_vendidos, 0),
        COALESCE((SELECT SUM(vt.cantidad_vendida) FROM venta_transito vt WHERE vt.pedido_proveedor_detalle_id = ppd.id), 0)
      )), 0)::numeric AS pares_vendidos
    FROM pedido_proveedor_detalle ppd
    JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
    WHERE pp.categoria_id = 3
      AND ppd.linea IS NOT NULL
      AND ppd.referencia IS NOT NULL
  `);
  const r = resumen.rows[0];
  pass(`Resumen: ${r.pedidos_pp} PP · ${r.moleculas} moléculas · inicial ${r.pares_inicial} · vendido ${r.pares_vendidos}`);

  if (Number(r.moleculas) === 0) {
    console.warn("WARN: sin moléculas programado — grilla vacía esperada");
  }

  const muestra = await pool.query(`
    SELECT
      pp.numero_registro,
      ppd.linea,
      ppd.referencia,
      ppd.cantidad_pares,
      pp.quincena_arribo_id,
      qa.descripcion AS quincena_desc
    FROM pedido_proveedor_detalle ppd
    JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
    LEFT JOIN quincena_arribo qa ON qa.id = pp.quincena_arribo_id
    WHERE pp.categoria_id = 3
      AND ppd.linea IS NOT NULL
    LIMIT 3
  `);

  for (const row of muestra.rows) {
    if (!row.linea) fail(`Fila PP ${row.numero_registro}: linea null`);
    if (row.quincena_arribo_id == null) fail(`Fila PP ${row.numero_registro}: quincena_arribo_id null`);
  }
  if (muestra.rows.length) pass(`Muestra ${muestra.rows.length} filas con linea + quincena_arribo_id`);

  const quincenas = await pool.query(`
    SELECT qa.id, qa.descripcion, COUNT(ppd.id)::int AS n
    FROM pedido_proveedor_detalle ppd
    JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
    JOIN quincena_arribo qa ON qa.id = pp.quincena_arribo_id
    WHERE pp.categoria_id = 3
    GROUP BY qa.id, qa.descripcion
    ORDER BY qa.id
    LIMIT 5
  `);
  pass(`Quincenas programado: ${quincenas.rows.map((q) => `${q.descripcion}(${q.n})`).join(", ") || "—"}`);
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
} finally {
  await pool.end();
}

console.log(ok ? "\nVERIFY PASS" : "\nVERIFY FAIL");
process.exit(ok ? 0 : 1);
