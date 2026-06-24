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
  path.join(__dirname, "..", "..", "control_central", "migrations", "118_caso_precio_biblioteca_unique_por_biblioteca.sql"),
  "utf8",
);
const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
});

const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  const uq = await client.query(
    `SELECT conname FROM pg_constraint WHERE conname = 'caso_precio_biblioteca_biblioteca_nombre_uq'`,
  );
  console.log("MIG-118 OK", uq.rows.length ? "constraint OK" : "WARN no constraint");
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("ERROR", e.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
