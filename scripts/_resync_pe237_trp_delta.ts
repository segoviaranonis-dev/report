/**
 * Aplica resync TRP PE-237 con delta FI≠detalle (post-fix grada infantil + PPD huérfano).
 */
import pg from "pg";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { resyncTraspasoDetalleFromFactura } from "../src/lib/rimec-abastecimiento/traspaso-mutations";
import { getTraspasoIntegridad } from "../src/lib/bazzar-web/compra-web/integridad";

const envPath = resolve(__dirname, "../.env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    process.env[t.slice(0, eq).trim()] ??= t
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
}

const docs = process.argv.slice(2);
const targets = docs.length ? docs : ["PE-237-010", "PE-237-008"];

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false },
  });
  const client = await pool.connect();
  try {
    for (const doc of targets) {
      const trp = await client.query<{ id: number; numero_registro: string }>(
        `SELECT id, numero_registro FROM traspaso WHERE documento_ref = $1 LIMIT 1`,
        [doc],
      );
      if (!trp.rows[0]) {
        console.log(doc, "SIN TRP");
        continue;
      }
      const id = Number(trp.rows[0].id);
      console.log("\n→", doc, trp.rows[0].numero_registro, "id=", id);
      await client.query("BEGIN");
      try {
        const r = await resyncTraspasoDetalleFromFactura(client, id);
        if (!r.ok) {
          await client.query("ROLLBACK");
          console.log("FAIL", r.error);
          continue;
        }
        await client.query("COMMIT");
        console.log("RESYNC", r);
        const integ = await getTraspasoIntegridad(id, client);
        console.log("INTEGRIDAD", integ);
      } catch (e) {
        await client.query("ROLLBACK");
        console.log("ERR", e instanceof Error ? e.message : e);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
