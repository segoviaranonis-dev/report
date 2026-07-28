/**
 * Aplica MIG-190 Logística Rimec (local).
 * Uso: node scripts/apply_mig_190_logistica_rimec.mjs
 */
import fs from "fs";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(root, ".env.local"), "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("FAIL: DATABASE_URL no encontrada");
  process.exit(1);
}

const sql = fs.readFileSync(path.join(root, "migrations", "190_logistica_rimec_pendiente.sql"), "utf8");
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(sql);
  const r = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_name LIKE 'logistica_rimec%'
     ORDER BY 1`,
  );
  console.log("OK MIG-190", r.rows.map((x) => x.table_name));
} finally {
  await client.end();
}
