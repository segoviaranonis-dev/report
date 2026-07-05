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

const r = await pool.query(`
  SELECT mtv.id_tipo, tv.descp_tipo, mtv.id_marca, mv.descp_marca
  FROM public.marca_tipo_v2 mtv
  JOIN public.tipo_v2 tv ON tv.id_tipo = mtv.id_tipo
  JOIN public.marca_v2 mv ON mv.id_marca = mtv.id_marca
  ORDER BY mtv.id_tipo, mtv.id_marca
`);
for (const row of r.rows) {
  console.log(`tipo_v2=${row.id_tipo} ${row.descp_tipo} | marca ${row.id_marca} ${row.descp_marca}`);
}
await pool.end();
