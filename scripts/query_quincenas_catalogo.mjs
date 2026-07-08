import pg from "pg";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(resolve(root, ".env.local"))) {
  for (const line of readFileSync(resolve(root, ".env.local"), "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const q1 = await pool.query(`
  SELECT quincena_arribo_id, quincena_desc, COUNT(*)::int AS filas, COUNT(DISTINCT pp_id)::int AS pps
  FROM v_stock_rimec
  WHERE cajas_disponibles > 0 AND quincena_arribo_id IS NOT NULL
  GROUP BY quincena_arribo_id, quincena_desc
  ORDER BY quincena_arribo_id
`);

const q2 = await pool.query(`SELECT id, descripcion FROM quincena_arribo ORDER BY id`);

const q3 = await pool.query(`
  SELECT pp.numero_registro, pp.estado, qa.descripcion AS quincena
  FROM pedido_proveedor pp
  LEFT JOIN quincena_arribo qa ON qa.id = pp.quincena_arribo_id
  WHERE pp.estado_transito = 'EN_TRANSITO'
    AND COALESCE(pp.categoria_id, (
      SELECT ic.categoria_id FROM intencion_compra_pedido icp
      JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
      WHERE icp.pedido_proveedor_id = pp.id ORDER BY icp.id LIMIT 1
    )) = 2
  ORDER BY pp.numero_registro
`);

console.log("=== QUINCENAS EN v_stock_rimec (vendible, dato duro) ===");
console.table(q1.rows);
console.log("=== Maestro quincena_arribo (todas) ===");
console.table(q2.rows);
console.log("=== PP alzados EN_TRANSITO ===");
console.table(q3.rows);

await pool.end();
