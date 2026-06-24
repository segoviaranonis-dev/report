/**
 * Promueve lote ABIERTO → PENDIENTE_CAJA (misma lógica que enviarStagingACaja corregida).
 * Uso: node scripts/promote_lote_caja.mjs [staging_id] [cliente_id]
 */
import fs from "fs";
import pg from "pg";

const LOTE = Number(process.argv[2] || 1);
const CLIENTE = Number(process.argv[3] || 2100);

const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const c = new pg.Client({ connectionString: url });
await c.connect();

try {
  await c.query("BEGIN");
  const cur = await c.query(
    `SELECT estado, count(*) FILTER (WHERE activo) AS activos
     FROM ticket_bandeja_cajero WHERE staging_id = $1 AND cliente_id = $2
     GROUP BY estado`,
    [LOTE, CLIENTE],
  );
  if (!cur.rows.length) {
    throw new Error(`Lote ${LOTE} no encontrado`);
  }
  if (cur.rows.some((r) => r.estado === "ABIERTO")) {
    await c.query(
      `SELECT id FROM ticket_bandeja_cajero WHERE staging_id = $1 AND cliente_id = $2 FOR UPDATE`,
      [LOTE, CLIENTE],
    );
    let fiFa = 1;
    const ctr = await c.query(
      `INSERT INTO pos_fi_fa_counter (cliente_id, last_num) VALUES ($1, 1)
       ON CONFLICT (cliente_id) DO UPDATE SET last_num = pos_fi_fa_counter.last_num + 1
       RETURNING last_num`,
      [CLIENTE],
    );
    fiFa = Number(ctr.rows[0]?.last_num ?? 1);
    await c.query(
      `UPDATE ticket_bandeja_cajero
       SET estado = 'PENDIENTE_CAJA', cerrado_at = now(), numero_fi_fa = $1
       WHERE staging_id = $2 AND cliente_id = $3 AND estado = 'ABIERTO' AND activo = true`,
      [fiFa, LOTE, CLIENTE],
    );
  }
  await c.query("COMMIT");
  const check = await c.query(
    `SELECT staging_id, estado, numero_fi_fa, count(*)::int AS filas
     FROM ticket_bandeja_cajero WHERE staging_id = $1 AND cliente_id = $2
     GROUP BY staging_id, estado, numero_fi_fa`,
    [LOTE, CLIENTE],
  );
  console.log("promote_ok", check.rows);
} catch (e) {
  await c.query("ROLLBACK");
  console.error("promote_fail", e instanceof Error ? e.message : e);
  process.exit(1);
} finally {
  await c.end();
}
