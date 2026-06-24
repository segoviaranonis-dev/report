import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
const env = fs.readFileSync(envPath, "utf8");
const m = env.match(/^DATABASE_URL=(.+)$/m);
if (!m) {
  console.error("NO DATABASE_URL");
  process.exit(1);
}
const url = m[1].trim().replace(/^"|"$/g, "");
const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
});

const tabs = [
  [2100, "deposito_1_2100_tienda"],
  [2900, "deposito_1_2900_tienda"],
  [2400, "deposito_1_2400_tienda"],
  [2700, "deposito_1_2700_tienda"],
  [3100, "deposito_1_3100_tienda"],
  [3200, "deposito_1_3200_tienda"],
];

for (const [id, t] of tabs) {
  try {
    const r = await pool.query(
      `SELECT COUNT(*)::int AS c, COALESCE(SUM(cantidad), 0)::float AS s FROM public.${t}`,
    );
    console.log(`${id}\t${t}\trows=${r.rows[0].c}\tpares=${r.rows[0].s}`);
  } catch (e) {
    console.log(`${id}\t${t}\tERR\t${e.message}`);
  }
}
await pool.end();
