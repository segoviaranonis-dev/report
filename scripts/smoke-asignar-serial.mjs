import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envText = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const dbUrl = envText.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();

const serial = "PRUEBA_FDO_1001900001";
const staging = await client.query(
  `SELECT staging_id FROM ticket_bandeja_cajero WHERE cliente_id=2100 AND estado='PENDIENTE_CAJA' LIMIT 1`,
);
const stagingId = staging.rows[0]?.staging_id;
if (!stagingId) {
  console.log("no bandeja pendiente");
  await client.end();
  process.exit(0);
}

const r = await client.query(
  `
    UPDATE public.ticket_bandeja_cajero
    SET numero_factura_legal = $1::text,
        snapshot_json = COALESCE(snapshot_json, '{}'::jsonb)
          || jsonb_build_object('numero_factura_legal', $1::text)
    WHERE cliente_id = $2 AND staging_id = $3
      AND upper(btrim(estado)) IN ('PENDIENTE_CAJA', 'CSV_DESCARGADO')
  `,
  [serial, 2100, stagingId],
);
console.log("updated", r.rowCount, "staging", stagingId);
await client.end();
