/**
 * Diagnóstico: PP ABIERTO/PREVENTA que NO están en catálogo web
 * Uso: node scripts/diagnostico_pp_catalogo_web.mjs
 */
import pg from "pg";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const envPath = resolve(root, ".env.local");

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("FAIL: DATABASE_URL en report/.env.local");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
});

try {
  const { rows: resumen } = await pool.query(`
    SELECT
      pp.estado,
      pp.estado_transito,
      COUNT(*)::int AS pp_count,
      COALESCE(SUM(sub.moleculas), 0)::int AS moleculas,
      COALESCE(SUM(sub.saldo), 0)::int AS pares_saldo
    FROM pedido_proveedor pp
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int AS moleculas,
        COALESCE(SUM(GREATEST(0, ppd.cantidad_pares - COALESCE(ppd.pares_vendidos, 0))), 0)::int AS saldo
      FROM pedido_proveedor_detalle ppd
      WHERE ppd.pedido_proveedor_id = pp.id AND ppd.referencia IS NOT NULL
    ) sub ON true
    WHERE COALESCE(pp.categoria_id, (
      SELECT ic.categoria_id FROM intencion_compra_pedido icp
      JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
      WHERE icp.pedido_proveedor_id = pp.id ORDER BY icp.id LIMIT 1
    )) = 2
    GROUP BY pp.estado, pp.estado_transito
    ORDER BY pp.estado, pp.estado_transito NULLS FIRST
  `);

  console.log("\n=== PP COMPRA PREVIA por estado / estado_transito ===");
  console.table(resumen);

  const { rows: faltan } = await pool.query(`
    SELECT
      pp.numero_registro,
      pp.estado,
      pp.estado_transito,
      sub.moleculas,
      sub.saldo AS pares_saldo,
      CASE
        WHEN pp.estado_transito IS DISTINCT FROM 'EN_TRANSITO' THEN 'Falta DESPLEGAR EN RIMEC WEB (estado_transito)'
        WHEN pp.quincena_arribo_id IS NULL THEN 'Falta quincena arribo'
        WHEN NOT EXISTS (
          SELECT 1 FROM intencion_compra_pedido icp
          JOIN precio_evento pe ON pe.id = icp.precio_evento_id
          WHERE icp.pedido_proveedor_id = pp.id AND pe.estado = 'cerrado'
        ) THEN 'Falta listado CERRADO vinculado'
        ELSE 'Revisar saldo/LPN'
      END AS causa
    FROM pedido_proveedor pp
    JOIN LATERAL (
      SELECT
        COUNT(*)::int AS moleculas,
        COALESCE(SUM(GREATEST(0, ppd.cantidad_pares - COALESCE(ppd.pares_vendidos, 0))), 0)::int AS saldo
      FROM pedido_proveedor_detalle ppd
      WHERE ppd.pedido_proveedor_id = pp.id AND ppd.referencia IS NOT NULL
    ) sub ON sub.saldo > 0
    WHERE pp.estado IN ('ABIERTO', 'ENVIADO', 'CERRADO')
      AND COALESCE(pp.categoria_id, (
        SELECT ic.categoria_id FROM intencion_compra_pedido icp
        JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
        WHERE icp.pedido_proveedor_id = pp.id ORDER BY icp.id LIMIT 1
      )) = 2
      AND NOT EXISTS (SELECT 1 FROM v_stock_rimec v WHERE v.pp_id = pp.id LIMIT 1)
    ORDER BY pp.numero_registro
    LIMIT 30
  `);

  console.log("\n=== PP con saldo pero FUERA de v_stock_rimec (top 30) ===");
  console.table(faltan);

  const { rows: vista } = await pool.query(`
    SELECT COUNT(*)::int AS filas, COUNT(DISTINCT pp_id)::int AS pps
    FROM v_stock_rimec WHERE cajas_disponibles > 0
  `);
  console.log("\n=== v_stock_rimec vendible ===");
  console.table(vista);
} finally {
  await pool.end();
}
