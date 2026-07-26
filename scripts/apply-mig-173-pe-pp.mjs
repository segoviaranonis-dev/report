/**
 * Aplica MIG-173 local (FI PE → pp_id).
 * node --env-file=.env.local scripts/apply-mig-173-pe-pp.mjs
 */
import fs from "fs";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL || process.env.RIMEC_DATABASE_URL;
if (!url) {
  console.error("FAIL: sin DATABASE_URL");
  process.exit(1);
}

const sqlPath = path.join(__dirname, "../migrations/173_fi_pe_pp_id_logistica_ok.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
try {
  const r = await pool.query(sql);
  console.log("MIG-173 applied");
  console.log(JSON.stringify(r.slice?.(-3) ?? r, null, 2).slice(0, 2000));
} catch (e) {
  console.error("FAIL MIG-173", e);
  process.exit(1);
} finally {
  await pool.end();
}
