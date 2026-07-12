import fs from "fs";
import pg from "pg";
import { backfillPpdPilarFks } from "../src/lib/pedido-proveedor/ppd-pilares-fk";

async function main() {
  const ppIds = process.argv.slice(2).map(Number).filter(Number.isFinite);
  const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
  const c = new pg.Client({ connectionString: url });
  await c.connect();

  for (const ppId of ppIds) {
    const fk = await backfillPpdPilarFks(c, ppId);
    console.log(JSON.stringify({ ppId, fk }));
  }

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
