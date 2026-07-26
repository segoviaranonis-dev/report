#!/usr/bin/env node
import fs from "fs";
import pg from "pg";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = fs.readFileSync(join(root, ".env.local"), "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) throw new Error("DATABASE_URL missing");

const sql = fs.readFileSync(join(root, "migrations/183_factura_carlos_text.sql"), "utf8");
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query(sql);
const r = await c.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name='factura_interna' AND column_name='factura_carlos'`,
);
console.log("MIG-183 OK", r.rows);
await c.end();
