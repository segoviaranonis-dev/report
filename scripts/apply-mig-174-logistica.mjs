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
const sql = fs.readFileSync(path.join(__dirname, "../migrations/174_logistica_ok_flujo_pestanias.sql"), "utf8");
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
try {
  await pool.query(sql);
  console.log("MIG-174 OK");
} catch (e) {
  console.error("FAIL MIG-174", e);
  process.exit(1);
} finally {
  await pool.end();
}
