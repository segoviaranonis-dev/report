/**
 * Smoke Admin LR · STOCK scopes (2.3.5.19):
 * - CP: L×R 2361-205/208 con thumb desde v_stock_rimec
 * - PE: filtro SDRM sigue PASS
 *
 * Uso: npx tsx scripts/_smoke_lr_stock_cp_pe_scopes.ts
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import pg from "pg";
import {
  loadLineaReferencia,
  loadPrimeraImagenLineaReferencia,
} from "../src/lib/pilares/queries";

const envPath = resolve(__dirname, "../.env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    process.env[t.slice(0, eq).trim()] ??= t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
}

function thumbUsable(
  t: { imagen_nombre?: string | null; material_code?: string; color_code?: string } | undefined,
): boolean {
  if (!t) return false;
  if (t.imagen_nombre?.trim()) return true;
  return Boolean(t.material_code?.trim() && t.color_code?.trim());
}

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false },
  });

  const pairs = [
    { linea_codigo: "2361", referencia_codigo: "205" },
    { linea_codigo: "2361", referencia_codigo: "208" },
  ];

  const inCp = await pool.query<{ n: string }>(
    `
    SELECT COUNT(*)::text AS n
    FROM v_stock_rimec v
    JOIN linea l ON l.id = v.linea_id
    JOIN referencia r ON r.id = v.referencia_id
    WHERE btrim(l.codigo_proveedor::text) = '2361'
      AND btrim(r.codigo_proveedor::text) = ANY($1::text[])
      AND COALESCE(v.cantidad_pares, 0) > 0
    `,
    [["205", "208"]],
  );
  assert.ok(Number(inCp.rows[0]?.n ?? 0) > 0, "2361-205/208 deben estar en v_stock_rimec");

  const thumbs = await loadPrimeraImagenLineaReferencia(pool, pairs, 1);
  for (const p of pairs) {
    const t = thumbs.get(`${p.linea_codigo}\0${p.referencia_codigo}`);
    assert.ok(thumbUsable(t), `thumb CP ${p.linea_codigo}-${p.referencia_codigo}: ${JSON.stringify(t)}`);
  }

  const listCp = await loadLineaReferencia(pool, 1, {
    origenTipo: "CP",
    buscar: "2361",
    limit: 50,
    offset: 0,
  });
  const codes = new Set(listCp.rows.map((r) => `${r.linea_codigo}-${r.referencia_codigo}`));
  assert.ok(codes.has("2361-205") || codes.has("2361-208") || listCp.total > 0, "CP lista 2361");

  const pe = await loadLineaReferencia(pool, 1, {
    origenTipo: "PRONTA_ENTREGA",
    limit: 5,
    offset: 0,
  });
  assert.ok(pe.total > 0, "PE scope SDRM > 0");

  const todos = await loadLineaReferencia(pool, 1, { limit: 1, offset: 0 });
  assert.ok(todos.total >= pe.total, "Todos >= PE");
  assert.ok(todos.total >= listCp.total, "Todos >= CP");

  console.log("PASS_LR_STOCK_CP_PE", {
    thumbs: {
      "205": thumbs.get("2361\u0000205"),
      "208": thumbs.get("2361\u0000208"),
    },
    cp_total: listCp.total,
    pe_total: pe.total,
    todos_total: todos.total,
  });

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
