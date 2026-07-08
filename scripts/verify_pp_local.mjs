import pg from "pg";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("FAIL: no DATABASE_URL");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
const BASE = "http://localhost:3000";
const checks = [];

function ok(label, detail = "") {
  checks.push({ ok: true, label, detail });
  console.log(`OK  ${label}${detail ? ` — ${detail}` : ""}`);
}
function fail(label, detail = "") {
  checks.push({ ok: false, label, detail });
  console.log(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
}

async function http(path) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
  return { status: res.status, ms: Date.now() - t0, location: res.headers.get("location") };
}

try {
  // 1 · Páginas
  for (const path of [
    "/proceso-importacion/pedido-proveedor",
    "/proceso-importacion/pedido-proveedor/14?tab=stock",
  ]) {
    const r = await http(path);
    if (r.status === 200) ok(`GET ${path}`, `${r.ms}ms`);
    else if (r.status === 307 || r.status === 302) fail(`GET ${path}`, `redirect ${r.status} → ${r.location}`);
    else fail(`GET ${path}`, `HTTP ${r.status}`);
  }

  // 2 · Lista SQL
  const tLista = Date.now();
  const lista = await pool.query(`
    SELECT COUNT(*)::int AS n FROM pedido_proveedor
    WHERE estado IN ('ABIERTO','CERRADO','ANULADO','ENVIADO')
  `);
  ok("SQL lista count", `${lista.rows[0].n} PP · ${Date.now() - tLista}ms`);

  // 3 · PP-14 estado
  const pp = await pool.query(`
    SELECT pp.id, pp.numero_registro, pp.numero_proforma, pp.estado, pp.estado_transito,
           pp.categoria_id, pp.quincena_arribo_id,
           (SELECT COUNT(*)::int FROM pedido_proveedor_detalle d WHERE d.pedido_proveedor_id = pp.id AND d.referencia IS NOT NULL) AS moleculas,
           (SELECT COALESCE(SUM(cantidad_pares),0)::int FROM pedido_proveedor_detalle d WHERE d.pedido_proveedor_id = pp.id) AS pares
    FROM pedido_proveedor pp WHERE pp.id = 14
  `);
  const row = pp.rows[0];
  if (!row) fail("PP-14 existe");
  else {
    ok("PP-14", `${row.numero_registro} · proforma ${row.numero_proforma ?? "—"} · ${row.estado_transito ?? "sin tránsito"}`);
    ok("PP-14 stock", `${row.moleculas} mol · ${row.pares} pares`);
    if (Number(row.categoria_id) === 2) ok("PP-14 categoría", "COMPRA PREVIA");
    else fail("PP-14 categoría", `id=${row.categoria_id}`);
  }

  // 4 · Listado vinculado
  const ev = await pool.query(`
    SELECT pe.id, pe.nombre_evento, pe.estado, COUNT(pl.id)::int AS n_precios
    FROM intencion_compra_pedido icp
    JOIN precio_evento pe ON pe.id = icp.precio_evento_id
    LEFT JOIN precio_lista pl ON pl.evento_id = pe.id
    WHERE icp.pedido_proveedor_id = 14
    GROUP BY pe.id, pe.nombre_evento, pe.estado
    LIMIT 1
  `);
  if (ev.rows[0]) ok("Listado PP-14", `${ev.rows[0].nombre_evento} · ${ev.rows[0].n_precios} precios · ${ev.rows[0].estado}`);
  else fail("Listado PP-14", "sin evento vinculado");

  // 5 · Catálogo web (solo CP, sin PE en vista)
  const peRows = await pool.query(`
    SELECT COUNT(*)::int AS n FROM v_stock_rimec
    WHERE cajas_disponibles > 0
      AND (
        UPPER(TRIM(COALESCE(origen_tipo,''))) IN ('PRONTA_ENTREGA','PRONTA ENTREGA')
        OR LOWER(TRIM(COALESCE(quincena_desc,''))) LIKE 'pronta entrega%'
      )
  `);
  const cpRows = await pool.query(`
    SELECT COUNT(*)::int AS n FROM v_stock_rimec v
    WHERE v.cajas_disponibles > 0 AND v.pp_id = 14
  `);
  ok("v_stock PP-14", `${cpRows.rows[0].n} filas catálogo`);
  if (Number(peRows.rows[0].n) === 0) ok("Sin PE en vista", "0 filas pronta entrega");
  else fail("PE en vista", `${peRows.rows[0].n} filas (hotfix rimec-web debe filtrar)`);

  const nFail = checks.filter((c) => !c.ok).length;
  console.log(`\n--- ${checks.length - nFail}/${checks.length} OK ---`);
  process.exit(nFail ? 1 : 0);
} catch (e) {
  console.error("ERROR", e.message);
  process.exit(1);
} finally {
  await pool.end();
}
