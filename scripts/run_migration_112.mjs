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
const sqlPath = path.join(
  __dirname,
  "..",
  "..",
  "control_central",
  "migrations",
  "112_depositos_bazzar_rename_codificado.sql",
);
const sql = fs.readFileSync(sqlPath, "utf8");
const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
});

const client = await pool.connect();
try {
  const before = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'deposito_%' ORDER BY 1`,
  );
  console.log("ANTES:", before.rows.map((r) => r.tablename).join(", "));
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  const after = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'deposito_%' ORDER BY 1`,
  );
  console.log("DESPUES:", after.rows.map((r) => r.tablename).join(", "));
  for (const [id, t] of [
    [2100, "deposito_2_fernando_adultos_tienda"],
    [2900, "deposito_2_fernando_ninos_tienda"],
    [2400, "deposito_3_sanmartin_adultos_tienda"],
    [2700, "deposito_3_sanmartin_ninos_tienda"],
    [3100, "deposito_1_palma_adultos_tienda"],
    [3200, "deposito_1_palma_ninos_tienda"],
  ]) {
    const r = await client.query(`SELECT COUNT(*)::int AS c FROM public.${t}`);
    console.log(`${id}\t${t}\trows=${r.rows[0].c}`);
  }
  console.log("MIGRACION 112 OK");
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("ERROR", e.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
