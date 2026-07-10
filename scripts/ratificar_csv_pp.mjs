import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { diagnoseProgramadoFiPlan } from "../src/lib/pedido-proveedor/proforma-programado-engine.ts";
import { exportCsvVentasPp, fetchCsvCarlosRows } from "../src/lib/pedido-proveedor/csv-ventas-export.ts";

const ppId = Number(process.argv[2] ?? 28);
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const plan = await diagnoseProgramadoFiPlan(ppId);
  const csv = await exportCsvVentasPp(pool, ppId, {
    numeroRegistro: ppId === 28 ? "PP-2026-0019" : "PP-2026-0017",
    numeroProforma: "8051/2026",
    categoriaId: 3,
  });
  const rows = await fetchCsvCarlosRows(pool, ppId, true);
  const distinctFi = new Set(rows.map((r) => r.fi_id));
  const fiRes = await pool.query("SELECT COUNT(*)::int AS c FROM factura_interna WHERE pp_id = $1", [ppId]);
  await pool.end();

  console.log(
    JSON.stringify(
      {
        plan,
        csv: {
          filename: csv.filename,
          lineas: csv.rowCount,
          bloques_shop: distinctFi.size,
          n_fi_bd: fiRes.rows[0]?.c ?? 0,
        },
        ok: plan.n_jobs === distinctFi.size && distinctFi.size === (fiRes.rows[0]?.c ?? 0),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
