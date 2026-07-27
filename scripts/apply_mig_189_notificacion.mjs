import fs from "fs";
import pg from "pg";

const env = fs.readFileSync("report/.env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("DATABASE_URL no encontrada");
  process.exit(1);
}

const sql = fs.readFileSync(
  "report/migrations/189_notificacion_deep_link_aprobacion.sql",
  "utf8",
);

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(sql);
  console.log("migracion 189 ok");
} finally {
  await client.end();
}
