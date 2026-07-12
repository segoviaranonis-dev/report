import pg from "pg";
import fs from "node:fs";
import { exportCsvVentasPp } from "../src/lib/pedido-proveedor/csv-ventas-export.ts";

const ppId = Number(process.argv[2] ?? 26);
const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const m = env.match(/^DATABASE_URL=(.+)$/m);
const pool = new pg.Pool({ connectionString: m[1].trim().replace(/^"|"$/g, "") });

try {
  const r = await exportCsvVentasPp(pool, ppId, {
    numeroRegistro: ppId === 26 ? "PP-2026-0017" : "PP-2026-0019",
    numeroProforma: ppId === 26 ? "8051/2026" : "8051/2026",
    categoriaId: 3,
  });
  let blocks = 0;
  for (const line of r.content.split(/\r?\n/)) {
    if (!line || line.startsWith("SHOP")) continue;
    const col0 = line.split(";")[0].trim();
    if (col0) blocks += 1;
  }
  const fi = await pool.query("SELECT COUNT(*)::int AS c FROM factura_interna WHERE pp_id = $1", [ppId]);
  console.log(JSON.stringify({ ppId, filename: r.filename, rows: r.rowCount, blocks, n_fi: fi.rows[0].c }));
} finally {
  await pool.end();
}
