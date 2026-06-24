/**
 * Aplica migración 007 (bandeja única operativa).
 * Uso: node scripts/run_migration_007.mjs
 */
import fs from "fs";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.resolve(__dirname, "../../tablet-bazzar/supabase/migrations/007_unify_bandeja_operativa.sql");

const env = fs.readFileSync(path.resolve(__dirname, "../.env.local"), "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("DATABASE_URL no encontrada");
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, "utf8");
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(sql);
  console.log("migration_007_ok");
} catch (e) {
  console.error("migration_007_fail", e instanceof Error ? e.message : e);
  process.exit(1);
} finally {
  await client.end();
}
