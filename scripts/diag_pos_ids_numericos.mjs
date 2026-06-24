/**
 * Simula primera venta: verifica nextval lote + FI_FA numéricos.
 */
import fs from "fs";
import pg from "pg";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  await client.query("BEGIN");
  const lote = await client.query(`SELECT nextval('ticket_bandeja_lote_id_seq') AS n`);
  const fiFa = await client.query(`
    INSERT INTO pos_fi_fa_counter (cliente_id, last_num) VALUES (2100, 1)
    ON CONFLICT (cliente_id) DO UPDATE SET last_num = pos_fi_fa_counter.last_num + 1
    RETURNING last_num
  `);
  console.log("next_lote_id", lote.rows[0].n, typeof lote.rows[0].n);
  console.log("next_fi_fa_2100", fiFa.rows[0].last_num, typeof fiFa.rows[0].last_num);
  await client.query("ROLLBACK");
} finally {
  await client.end();
}
