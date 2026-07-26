#!/usr/bin/env node
import fs from "fs";
import pg from "pg";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = fs.readFileSync(join(root, ".env.local"), "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) throw new Error("DATABASE_URL missing");

const sql = fs.readFileSync(join(root, "migrations/184_factura_carlos_integridad_pp.sql"), "utf8");
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  await c.query(sql);
  const r = await c.query(`
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.factura_interna'::regclass AND conname = 'chk_fi_factura_carlos_digits'
  `);
  console.log("MIG-184 OK", r.rows);
} finally {
  await c.end();
}
