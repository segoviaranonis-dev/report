/**
 * Import batch CSV Bazzar — misma lógica que POST /api/depositos/import-csv (pilares + timing).
 *
 * Uso:
 *   npx tsx scripts/import_bazzar_batch_cli.ts ..\sdfm4708.csv ..\sdsm4708.csv ..\sdpl4708.csv
 *   npx tsx scripts/import_bazzar_batch_cli.ts ..\sdfm4708.csv --dry-run
 *   npx tsx scripts/import_bazzar_batch_cli.ts file.csv --merge
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { importBazzarCsvBatch, type ImportCsvMode } from "../src/lib/depositos/bazzar-csv-import";
import { getRimecPool } from "../src/lib/rimec/pool";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) throw new Error(".env.local no encontrado");
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    if (process.env[key]) continue;
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const mode: ImportCsvMode = argv.includes("--merge") ? "merge" : "replace";
  const files = argv.filter((a) => !a.startsWith("--"));

  if (!files.length) {
    console.error(
      "Uso: npx tsx scripts/import_bazzar_batch_cli.ts <csv...> [--dry-run] [--merge]",
    );
    process.exit(1);
  }

  const batch = files.map((f) => {
    const abs = path.resolve(f);
    return {
      filename: path.basename(abs),
      content: fs.readFileSync(abs, "latin1"),
    };
  });

  console.log(`[import] archivos=${batch.map((b) => b.filename).join(", ")}`);
  console.log(`[import] modo=${mode} dry_run=${dryRun}`);
  console.log("[import] Latido: import en curso…");

  const pool = getRimecPool();
  const t0 = Date.now();
  const result = await importBazzarCsvBatch(pool, batch, mode, dryRun);
  const elapsed = Date.now() - t0;

  console.log(JSON.stringify(result, null, 2));
  console.log(
    `[import] FIN total=${(elapsed / 1000).toFixed(1)}s success=${result.success} pilares_ms=${result.timing?.pilares_ms ?? "—"} deposito_ms=${result.timing?.deposito_ms ?? "—"}`,
  );

  await pool.end();
  process.exit(result.success ? 0 : 1);
}

main().catch((e) => {
  console.error("[import] ERROR", e instanceof Error ? e.message : e);
  process.exit(1);
});
