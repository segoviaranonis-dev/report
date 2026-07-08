import pg from "pg";
import fs from "node:fs";
import { exportCsvVentasPp } from "../src/lib/pedido-proveedor/csv-ventas-export.ts";

const env = fs.readFileSync("c:/Users/hecto/Nexus_Core/report/.env.local", "utf8");
const m = env.match(/^DATABASE_URL=(.+)$/m);
const pool = new pg.Pool({ connectionString: m[1].trim().replace(/^"|"$/g, "") });

try {
  const r = await exportCsvVentasPp(pool, 15, {
    numeroRegistro: "PP-2026-0015",
    numeroProforma: "PRG_8604-2026",
    categoriaId: 3,
  });
  console.log("OK", r.filename, "rows", r.rowCount, "bytes", r.content.length);
  console.log(r.content.split("\n")[2]?.slice(0, 120));
} catch (e) {
  console.error("FAIL", e);
} finally {
  await pool.end();
}
