import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const m = env.match(/^DATABASE_URL=(.+)$/m);
if (!m) {
  console.error("NO DATABASE_URL");
  process.exit(1);
}
const url = m[1].trim().replace(/^"|"$/g, "");
const sql = fs.readFileSync(
  path.join(__dirname, "..", "..", "control_central", "migrations", "114_depositos_bazzar_rename_cliente_id.sql"),
  "utf8",
);
const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
});

const TIENDA = [
  [2100, "deposito_1_2100_tienda"],
  [2900, "deposito_1_2900_tienda"],
  [2400, "deposito_1_2400_tienda"],
  [2700, "deposito_1_2700_tienda"],
  [3100, "deposito_1_3100_tienda"],
  [3200, "deposito_1_3200_tienda"],
];

const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  const tabs = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'deposito_%' ORDER BY 1`,
  );
  console.log("TABLAS:", tabs.rows.length);
  for (const r of tabs.rows) console.log(" ", r.tablename);
  console.log("--- TIENDA ---");
  for (const [id, t] of TIENDA) {
    const r = await client.query(`SELECT COUNT(*)::int AS c FROM public.${t}`);
    console.log(`${id}\t${t}\trows=${r.rows[0].c}`);
  }
  console.log("MIGRACION 114 OK");
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("ERROR", e.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
