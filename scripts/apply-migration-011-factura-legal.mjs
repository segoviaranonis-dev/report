/**
 * Aplica migración 011 — caja_factura_legal_turno (serial legal por tienda).
 * Uso: node scripts/apply-migration-011-factura-legal.mjs
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

const sqlPath = path.join(__dirname, "..", "..", "tablet-bazzar", "supabase", "migrations", "011_caja_factura_legal_turno.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(sql);
  const check = await client.query(`
    SELECT cliente_id, serial_activo FROM public.caja_factura_legal_turno ORDER BY cliente_id
  `);
  console.log("OK migración 011 · filas:", check.rows);
} finally {
  await client.end();
}
