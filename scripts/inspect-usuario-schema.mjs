/**
 * Inspecciona esquema usuario_v2 y tablas rol en BD.
 * Uso: node scripts/inspect-usuario-schema.mjs
 */
import pg from "pg";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "../.env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL no encontrada en .env.local");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

const cols = await pool.query(`
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'usuario_v2'
  ORDER BY ordinal_position
`);

console.log("=== usuario_v2 columns ===");
for (const r of cols.rows) {
  console.log(`${r.column_name}\t${r.data_type}\tnullable=${r.is_nullable}`);
}

const fks = await pool.query(`
  SELECT kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
  WHERE tc.table_schema = 'public' AND tc.table_name = 'usuario_v2' AND tc.constraint_type = 'FOREIGN KEY'
`);

console.log("\n=== usuario_v2 foreign keys ===");
if (fks.rows.length === 0) console.log("(ninguna FK declarada)");
for (const r of fks.rows) {
  console.log(`${r.column_name} -> ${r.foreign_table}.${r.foreign_column}`);
}

const rolTables = await pool.query(`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name ILIKE '%rol%'
  ORDER BY table_name
`);

console.log("\n=== public tables matching *rol* ===");
for (const r of rolTables.rows) {
  console.log(r.table_name);
}

const catTables = await pool.query(`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name ILIKE '%categoria%'
  ORDER BY table_name
`);

console.log("\n=== public tables matching *categoria* ===");
for (const r of catTables.rows) {
  console.log(r.table_name);
}

await pool.end();
