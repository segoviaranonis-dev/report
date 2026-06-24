import fs from "fs";
import pg from "pg";

const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const c = new pg.Client({ connectionString: url });
await c.connect();
try {
  const rows = await c.query(`
    SELECT id, staging_id, estado, activo, numero_fi_fa, codigo_bandeja, grada
    FROM ticket_bandeja_cajero WHERE cliente_id = 2100 ORDER BY id
  `);
  const idx = await c.query(`
    SELECT indexdef FROM pg_indexes WHERE indexname = 'uq_tbc_cliente_fi_fa_activo'
  `);
  const ctr = await c.query(`SELECT * FROM pos_fi_fa_counter WHERE cliente_id = 2100`);
  console.log(JSON.stringify({ rows: rows.rows, index: idx.rows[0]?.indexdef, counter: ctr.rows }, null, 2));
} finally {
  await c.end();
}
