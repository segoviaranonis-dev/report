/**
 * Aplica migración 010 — precio_unitario en bandeja + bóveda.
 * Uso: node scripts/apply-migration-010-precio-pos.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
const env = fs.readFileSync(envPath, "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("DATABASE_URL no encontrada en report/.env.local");
  process.exit(1);
}

const sqlPath = path.join(
  __dirname,
  "..",
  "..",
  "tablet-bazzar",
  "supabase",
  "migrations",
  "010_precio_unitario_bandeja_bobeda.sql",
);
const sql = fs.readFileSync(sqlPath, "utf8");

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(sql);
  const check = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM information_schema.columns
       WHERE table_name = 'ticket_bandeja_cajero' AND column_name = 'precio_unitario') AS bandeja_col,
      (SELECT COUNT(*)::int FROM information_schema.columns
       WHERE table_name = 'bobeda_venta_pos' AND column_name = 'precio_unitario') AS bobeda_col
  `);
  console.log("OK migración 010", check.rows[0]);
} finally {
  await client.end();
}
