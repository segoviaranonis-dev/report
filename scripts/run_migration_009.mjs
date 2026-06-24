import fs from "fs";
import pg from "pg";

const sql = fs.readFileSync(
  "../tablet-bazzar/supabase/migrations/009_fix_fi_fa_unique_per_lote.sql",
  "utf8",
);
const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const c = new pg.Client({ connectionString: url });
await c.connect();
try {
  await c.query(sql);
  const idx = await c.query(
    `SELECT indexname FROM pg_indexes WHERE tablename = 'ticket_bandeja_cajero' AND indexname LIKE 'uq_tbc%'`,
  );
  console.log("migration_009_ok", idx.rows);
} finally {
  await c.end();
}
