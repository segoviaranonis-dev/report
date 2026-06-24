import fs from "fs";
import pg from "pg";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("NO DATABASE_URL");
  process.exit(1);
}

const tables = [
  "ticket_venta_pos",
  "ticket_pos_staging",
  "clients_bazaar",
  "vendedor_bazzar",
  "ticket_bandeja_cajero",
  "bobeda_venta_pos",
];

const client = new pg.Client({ connectionString: url });
await client.connect();

const r = await client.query(
  `SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
  [tables],
);
const have = new Set(r.rows.map((x) => x.table_name));
for (const t of tables) {
  console.log(`${t}: ${have.has(t) ? "OK" : "MISSING"}`);
}

if (have.has("ticket_bandeja_cajero") && have.has("bobeda_venta_pos")) {
  const cnt = await client.query(`
    SELECT
      (SELECT count(*)::int FROM ticket_bandeja_cajero) AS bandeja,
      (SELECT count(*)::int FROM bobeda_venta_pos) AS bobeda,
      (SELECT count(*)::int FROM ticket_venta_pos WHERE upper(btrim(estado)) = 'EMITIDO') AS legacy_emitido
  `);
  console.log("counts", JSON.stringify(cnt.rows[0]));
}

await client.end();
