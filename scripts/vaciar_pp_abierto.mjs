/**
 * Vacía PP abierto (herramienta reposición AM).
 * Solo toca pp_abierto_import + pp_abierto_import_fila.
 * Orden Director 2026-08-10: KPI → 0 · preparar nueva proforma.
 */
import fs from "fs";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.resolve(__dirname, "../.env.local"), "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim()?.replace(/^["']|["']$/g, "");
if (!url) throw new Error("DATABASE_URL");

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function audit(label) {
  const cab = await pool.query(`
    SELECT id, factura_nro, factura_fecha, total_filas, total_pares, activo, created_at
    FROM pp_abierto_import
    ORDER BY id`);
  const filas = await pool.query(`
    SELECT COUNT(*)::int AS n, COALESCE(SUM(pares),0)::int AS pares
    FROM pp_abierto_import_fila`);
  const activas = await pool.query(`
    SELECT COUNT(*)::int AS n, COALESCE(SUM(total_pares),0)::int AS pares
    FROM pp_abierto_import WHERE activo = true`);
  console.log(`\n=== ${label} ===`);
  console.log("cabeceras:", cab.rows.length, cab.rows);
  console.log("filas totales:", filas.rows[0]);
  console.log("activas (KPI fuente):", activas.rows[0]);
  return { cab: cab.rows, filas: filas.rows[0], activas: activas.rows[0] };
}

try {
  const before = await audit("ANTES");
  if (before.cab.length === 0 && before.filas.n === 0) {
    console.log("\nYa vacío. Nada que borrar.");
    process.exit(0);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // 1) Desactivar (KPI deja de leer)
    const deact = await client.query(
      `UPDATE pp_abierto_import SET activo = false WHERE activo = true RETURNING id, factura_nro, total_pares`,
    );
    console.log("\ndesactivadas:", deact.rows);

    // 2) Borrar filas + cabeceras (CASCADE en FK también, pero explícito)
    const delF = await client.query(`DELETE FROM pp_abierto_import_fila RETURNING id`);
    const delC = await client.query(`DELETE FROM pp_abierto_import RETURNING id, factura_nro`);
    console.log("filas borradas:", delF.rowCount);
    console.log("cabeceras borradas:", delC.rows);

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  const after = await audit("DESPUÉS");
  if (after.activas.n !== 0 || after.activas.pares !== 0 || after.filas.n !== 0 || after.cab.length !== 0) {
    console.error("\nFAIL: quedó residuo PP abierto");
    process.exit(1);
  }
  console.log("\nPASS: PP abierto vacío · KPI fuente = 0 · listo para nueva proforma");
} finally {
  await pool.end();
}
