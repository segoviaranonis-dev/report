import fs from "fs";
import pg from "pg";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("NO DATABASE_URL");
  process.exit(1);
}

const sql = fs.readFileSync("../tablet-bazzar/supabase/migrations/006_fi_fa_counter.sql", "utf8");
const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(sql);
console.log("migration_006_ok");
await client.end();
