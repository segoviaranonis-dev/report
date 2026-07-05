import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!url) throw new Error("DATABASE_URL missing");

const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
});

await pool.query(`
  CREATE OR REPLACE VIEW public.vendedor_v2 AS
  SELECT id_vendedor, descp_vendedor, created_at, usuario_id
  FROM public.vendedor_v2_deprecated
`);

const check = await pool.query(
  "SELECT id_vendedor AS id, descp_vendedor AS label FROM vendedor_v2 ORDER BY descp_vendedor",
);
console.log("vendedor_v2 view OK:", check.rows.length, "rows");
console.log(check.rows.slice(0, 5));

await pool.end();
