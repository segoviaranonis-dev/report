/**
 * Aplica MIG-114 (fecha_confirmacion + trigger + índices).
 * Uso: node scripts/aplicar_migracion_114.mjs
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
  console.error("FAIL: DATABASE_URL no encontrada en report/.env.local");
  process.exit(1);
}

const sql = readFileSync(resolve(root, "migrations/114_fi_fecha_confirmacion.sql"), "utf8");
const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
});

console.log("MIG-114: fecha_confirmacion + trigger + índices…");

const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  console.log("OK: migración aplicada");

  const col = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'factura_interna'
      AND column_name = 'fecha_confirmacion'
  `);
  console.log("Columna:", col.rows[0] ? `${col.rows[0].column_name} (${col.rows[0].data_type})` : "MISSING");

  const trig = await client.query(`
    SELECT tgname FROM pg_trigger
    WHERE tgname = 'trg_fi_fecha_confirmacion'
  `);
  console.log("Trigger:", trig.rows.length ? trig.rows[0].tgname : "MISSING");

  const stats = await client.query(`
    SELECT estado, COUNT(*)::int AS n,
           COUNT(fecha_confirmacion)::int AS con_fecha
    FROM public.factura_interna
    WHERE estado IN ('RESERVADA', 'CONFIRMADA', 'ANULADA')
    GROUP BY estado
    ORDER BY estado
  `);
  console.log("FI por estado:", stats.rows);

  const idx = await client.query(`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'factura_interna'
      AND (indexname LIKE 'idx_fi_%confirm%' OR indexname = 'idx_fi_aprobaciones_csv_sort')
  `);
  console.log("Índices:", idx.rows.map((r) => r.indexname).join(", ") || "(verificar manualmente)");
} catch (e) {
  await client.query("ROLLBACK");
  console.error("FAIL:", e.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
