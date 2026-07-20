/**
 * Aplica migración 170 — pp_abierto_import (Herramienta reposición).
 * Uso: node scripts/run_migration_170.mjs
 */
import fs from "fs";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.resolve(__dirname, "../migrations/170_pp_abierto_reposicion.sql");

const env = fs.readFileSync(path.resolve(__dirname, "../.env.local"), "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("DATABASE_URL no encontrada");
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, "utf8");
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(sql);
  console.log("migration_170_ok");
} catch (e) {
  console.error("migration_170_fail", e instanceof Error ? e.message : e);
  process.exit(1);
} finally {
  await client.end();
}
