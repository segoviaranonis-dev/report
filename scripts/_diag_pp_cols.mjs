import fs from "fs";
import pg from "pg";

const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const c = new pg.Client({ connectionString: url });
await c.connect();
const r = await c.query(
  `SELECT column_name, data_type FROM information_schema.columns
   WHERE table_schema='public' AND table_name='pedido_proveedor' ORDER BY ordinal_position`,
);
console.log(r.rows);
await c.end();
