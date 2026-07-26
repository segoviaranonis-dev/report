import fs from "fs";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("FAIL: sin DATABASE_URL");
  process.exit(1);
}
const sql = fs.readFileSync(path.join(__dirname, "../migrations/179_logistica_observacion_hilo.sql"), "utf8");
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
try {
  await pool.query(sql);
  console.log("MIG-179 OK");
} catch (e) {
  console.error("FAIL MIG-179", e);
  process.exit(1);
} finally {
  await pool.end();
}
