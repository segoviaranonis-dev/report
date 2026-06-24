import fs from "fs";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.resolve(__dirname, "../../tablet-bazzar/supabase/migrations/008_bandeja_integridad_escala.sql");
const env = fs.readFileSync(path.resolve(__dirname, "../.env.local"), "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(fs.readFileSync(sqlPath, "utf8"));
  console.log("migration_008_ok");
} catch (e) {
  console.error("migration_008_fail", e instanceof Error ? e.message : e);
  process.exit(1);
} finally {
  await client.end();
}
