#!/usr/bin/env node
/** Borra IC PROGRAMADO PENDIENTE del lote 2026-07-09 (IC-2026-0112…0523). */
import fs from "fs";
import pg from "pg";

const DRY = process.argv.includes("--dry-run");
const url = fs.readFileSync("c:/Users/hecto/Nexus_Core/report/.env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const pool = new pg.Pool({ connectionString: url });

const FROM = 112;
const TO = 523;
const nums = [];
for (let n = FROM; n <= TO; n++) nums.push(`IC-2026-${String(n).padStart(4, "0")}`);

try {
  const { rows: found } = await pool.query(
    `SELECT ic.id, ic.numero_registro, ic.estado,
            (SELECT COUNT(*)::int FROM intencion_compra_pedido icp WHERE icp.intencion_compra_id = ic.id) AS pp_links
     FROM intencion_compra ic
     WHERE ic.numero_registro = ANY($1::text[])`,
    [nums],
  );
  console.log(`Encontradas: ${found.length} / ${nums.length}`);
  const bloqueadas = found.filter((r) => r.pp_links > 0 || r.estado !== "PENDIENTE_OPERATIVO");
  if (bloqueadas.length) {
    console.error("Bloqueadas (PP o no pendiente):", bloqueadas.slice(0, 10));
    process.exit(1);
  }
  if (DRY) {
    console.log("DRY-RUN · se borrarían", found.length, "IC");
    process.exit(0);
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ids = found.map((r) => Number(r.id));
    await client.query("DELETE FROM intencion_compra WHERE id = ANY($1::int[])", [ids]);
    await client.query("COMMIT");
    console.log(JSON.stringify({ ok: true, borradas: ids.length, rango: [nums[0], nums[nums.length - 1]] }));
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  const { rows: pend } = await pool.query(
    "SELECT COUNT(*)::int n FROM intencion_compra WHERE estado='PENDIENTE_OPERATIVO' AND categoria_id=3",
  );
  console.log("Pendientes PROGRAMADO restantes:", pend[0].n);
} finally {
  await pool.end();
}
