import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const m = env.match(/^DATABASE_URL=(.+)$/m);
if (!m) { console.error("NO DATABASE_URL"); process.exit(1); }
const url = m[1].trim().replace(/^"|"$/g, "");
const sql = fs.readFileSync(path.join(__dirname, "..", "migrations", "152_rimec_catalogo_meta_rpc_ramo.sql"), "utf8");
const pool = new pg.Pool({ connectionString: url, ssl: url.includes("localhost") ? false : { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  const t0 = Date.now();
  const meta = await client.query(`SELECT public.rimec_catalogo_meta(true, NULL, NULL, NULL, NULL, NULL, 'CALZADO', NULL, NULL) AS m`);
  console.log("MIG-152 OK", Date.now() - t0, "ms PE meta marcas:", meta.rows[0]?.m?.marcas?.length ?? 0);
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("ERROR", e.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
