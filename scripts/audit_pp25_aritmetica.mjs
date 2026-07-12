#!/usr/bin/env node
/**
 * Auditoría aritmética PP PROGRAMADO — Alejandro Magno.
 * Uso: node scripts/audit_pp25_aritmetica.mjs [ppId]
 */
import pg from "pg";

const ppId = Number(process.argv[2] ?? 25);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const checks = [];

function ok(name, pass, detail) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "✅" : "❌"} ${name}: ${detail}`);
}

try {
  const { rows: pp } = await pool.query(
    `SELECT id, numero_registro, categoria_id FROM pedido_proveedor WHERE id = $1`,
    [ppId],
  );
  if (!pp.length) {
    console.error(`PP ${ppId} no encontrado`);
    process.exit(1);
  }
  ok("PP existe", true, `${pp[0].numero_registro} · cat=${pp[0].categoria_id}`);

  const { rows: agg } = await pool.query(
    `
    SELECT
      (SELECT COUNT(*)::int FROM pedido_proveedor_detalle WHERE pedido_proveedor_id = $1) AS ppd_c,
      (SELECT COALESCE(SUM(cantidad_pares),0)::int FROM pedido_proveedor_detalle WHERE pedido_proveedor_id = $1) AS ppd_pares,
      (SELECT COALESCE(SUM(pares_vendidos),0)::int FROM pedido_proveedor_detalle WHERE pedido_proveedor_id = $1) AS ppd_vend,
      (SELECT COUNT(*)::int FROM factura_interna WHERE pp_id = $1) AS fi_c,
      (SELECT COALESCE(SUM(total_pares),0)::int FROM factura_interna WHERE pp_id = $1) AS fi_pares,
      (SELECT COALESCE(SUM(cantidad_vendida),0)::int FROM venta_transito WHERE pedido_proveedor_id = $1) AS vt,
      (SELECT COUNT(*)::int FROM intencion_compra_pedido icp JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id WHERE icp.pedido_proveedor_id = $1) AS ic_c
    `,
    [ppId],
  );
  const a = agg[0];
  ok("PPD moléculas", a.ppd_c > 0, String(a.ppd_c));
  ok("FI count", true, String(a.fi_c));
  ok("IC vinculadas", a.ic_c > 0, String(a.ic_c));
  ok("Σ pares PPD = Σ pares FI", a.ppd_pares === a.fi_pares || a.fi_c === 0, `${a.ppd_pares} vs ${a.fi_pares}`);
  ok("venta_transito Web = 0", a.vt === 0, String(a.vt));
  ok("PROGRAMADO 100% vendido", a.ppd_vend === a.ppd_pares || a.fi_c === 0, `${a.ppd_vend}/${a.ppd_pares}`);

  const { rows: lpMismatch } = await pool.query(
    `
    SELECT COUNT(*)::int AS n
    FROM factura_interna fi
    JOIN intencion_compra ic ON ic.id_cliente = fi.cliente_id
    JOIN intencion_compra_pedido icp ON icp.intencion_compra_id = ic.id AND icp.pedido_proveedor_id = fi.pp_id
    WHERE fi.pp_id = $1
      AND fi.lista_precio_id IS DISTINCT FROM ic.listado_precio_id
    `,
    [ppId],
  );
  ok("FI.lista_precio_id = IC.listado_precio_id", lpMismatch[0].n === 0, `mismatch=${lpMismatch[0].n}`);

  const { rows: syncRows } = await pool.query(
    `
    SELECT COUNT(*)::int AS bad
    FROM pedido_proveedor_detalle
    WHERE pedido_proveedor_id = $1
      AND cantidad_pares > 0
      AND pares_vendidos IS DISTINCT FROM cantidad_pares
    `,
    [ppId],
  );
  ok("pares_vendidos = cantidad_pares (todas filas)", syncRows[0].bad === 0 || a.fi_c === 0, `bad=${syncRows[0].bad}`);

  const fail = checks.filter((c) => !c.pass).length;
  console.log(fail ? `\nFAIL ${fail} check(s)` : "\nPASS aritmética BD");
  process.exit(fail ? 1 : 0);
} catch (e) {
  console.error(e);
  process.exit(2);
} finally {
  await pool.end();
}
