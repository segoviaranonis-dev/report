import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { importBazzarCsvFile } from "../src/lib/depositos/bazzar-csv-import";
import { getRimecPool } from "../src/lib/rimec/pool";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq <= 0) continue;
  const key = t.slice(0, eq).trim();
  if (process.env[key]) continue;
  process.env[key] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
}

const csv = fs.readFileSync(path.join(__dirname, "..", "..", "sdfm4708.csv"), "latin1");

async function main() {
  const pool = getRimecPool();
  try {
    const r = await importBazzarCsvFile(pool, "sdfm4708.csv", csv, "replace", false);
    console.log("OK", JSON.stringify(r.tablas, null, 2));
  } catch (e) {
    console.error("FAIL", e);
  }
  await pool.end();
}

main();
