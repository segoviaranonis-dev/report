#!/usr/bin/env node
/** Import cierre PP — node scripts/run-import-cierre-pp.mjs [ppId] [csvPath] [--dry-run] */
import { readFileSync, existsSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const dryRun = process.argv.includes("--dry-run");
const ppId = Number(args[0] || 38);
const csvPath = args[1];

const { importCierreImportacionCsv } = await import(
  "../src/lib/pedido-proveedor/import-cierre-importacion.ts"
);
const { buildIcCierreImportacionCsv, listIcCierreImportacionRows } = await import(
  "../src/lib/pedido-proveedor/ic-cierre-importacion-csv.ts"
);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

let csvText;
if (csvPath) {
  csvText = readFileSync(csvPath, "utf8");
} else {
  const rows = await listIcCierreImportacionRows(pool, ppId);
  csvText = buildIcCierreImportacionCsv(rows);
  const out = join(root, "tmp", `cierre_pp${ppId}_export.csv`);
  writeFileSync(out, csvText, "utf8");
  console.log("Export baseline →", out);
}

const result = await importCierreImportacionCsv(pool, ppId, csvText, {
  dryRun,
  syncLogistica: !dryRun,
});
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(2);
await pool.end();
