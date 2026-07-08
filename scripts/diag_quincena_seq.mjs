import pg from "pg";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(resolve(root, ".env.local"), "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq <= 0) continue;
  process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const max = await pool.query("SELECT COALESCE(MAX(id),0)::int AS m FROM quincena_arribo");
const seq = await pool.query("SELECT pg_get_serial_sequence('quincena_arribo','id') AS s");
console.log("max id:", max.rows[0], "sequence:", seq.rows[0]);
await pool.end();
