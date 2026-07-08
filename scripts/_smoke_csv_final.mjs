import pg from "pg";
import fs from "node:fs";
import { exportCsvVentasPp } from "../src/lib/pedido-proveedor/csv-ventas-export.ts";

const env = fs.readFileSync("c:/Users/hecto/Nexus_Core/report/.env.local", "utf8");
const m = env.match(/^DATABASE_URL=(.+)$/m);
const pool = new pg.Pool({ connectionString: m[1].trim().replace(/^"|"$/g, "") });

const r = await exportCsvVentasPp(pool, 15, {
  numeroRegistro: "PP-2026-0015",
  numeroProforma: "PRG_8604-2026",
  categoriaId: 3,
});
const lines = r.content.split(/\r?\n/).slice(0, 8);
console.log("header:", lines[0]);
for (const ln of lines.slice(1, 6)) {
  const cols = ln.split(";");
  console.log("K=", cols[10], "| grada=", cols[7], "| caso=", cols[8]?.slice(0, 40));
}
await pool.end();
