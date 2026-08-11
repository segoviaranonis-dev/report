/**
 * Emparejamiento vendedor PP — auditar / reparar fi.vendedor_id desde IC pareada.
 * Uso:
 *   npx tsx scripts/_audit_pp_vendedor_integridad.ts 94
 *   APPLY=1 npx tsx scripts/_audit_pp_vendedor_integridad.ts 94
 */
import { readFileSync } from "fs";
import { createRequire } from "module";
import {
  auditarIntegridadVendedorPp,
  repararVendedorFiDesdeIcPp,
} from "../src/lib/pedido-proveedor/vendedor-pp-integridad";

const require = createRequire(import.meta.url);
const pg = require("pg");

async function main() {
  const ppId = Number(process.argv[2] || "94");
  if (!Number.isFinite(ppId) || ppId <= 0) {
    console.error("Uso: npx tsx scripts/_audit_pp_vendedor_integridad.ts <pp_id>");
    process.exit(1);
  }

  const apply = process.env.APPLY === "1";
  const env = readFileSync("C:/Users/hecto/Nexus_Core/report/.env.local", "utf8");
  const url = env.match(/^DATABASE_URL=(.+)$/m)![1].trim().replace(/^["']|["']$/g, "");
  const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

  try {
    const before = await auditarIntegridadVendedorPp(pool, ppId);
    console.log("AUDIT_BEFORE", JSON.stringify(before, null, 2));

    if (!before.ok) {
      const repair = await repararVendedorFiDesdeIcPp(pool, ppId, { dryRun: !apply });
      console.log("REPAIR", JSON.stringify(repair, null, 2));

      if (apply && repair.fixed.length) {
        const after = await auditarIntegridadVendedorPp(pool, ppId);
        console.log("AUDIT_AFTER", JSON.stringify(after, null, 2));
      } else if (!apply) {
        console.log("DRY_RUN — repetir con APPLY=1 para escribir BD");
      }
    } else {
      console.log("OK — integridad vendedor PP", ppId);
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
