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
  path.join(__dirname, "..", "..", "control_central", "migrations", "119_usuario_bloqueado_governance.sql"),
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
  const col = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'usuario_v2' AND column_name = 'bloqueado'`,
  );
  console.log("MIG-119 OK", col.rows.length ? "bloqueado column OK" : "WARN");
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("ERROR", e.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
